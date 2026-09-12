import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';
import { Observable, Subscription, timer } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AssistantService } from '../../../core/services/assistant.service';
import { AssistantContextService } from '../../../core/services/assistant-context.service';
import { PermissionCodes } from '../../../core/models/permission.models';
import { AssistantChatMessage, ScreenContext } from '../../../core/models/assistant.models';
import { MarkdownLitePipe } from '../../pipes/markdown-lite.pipe';

@Component({
  selector: 'app-assistant-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownLitePipe],
  templateUrl: './assistant-bubble.component.html',
  styleUrls: ['./assistant-bubble.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantBubbleComponent implements AfterViewChecked {
  @ViewChild('scroll') private scrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') private composerRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('launcher') private launcherRef?: ElementRef<HTMLButtonElement>;

  private readonly destroyRef = inject(DestroyRef);

  readonly visible$: Observable<boolean>;
  readonly context$: Observable<ScreenContext>;
  readonly suggestions$: Observable<string[]>;

  private static readonly THOUGHT_INTERVAL_MS = 180_000;
  private static readonly THOUGHT_VISIBLE_MS = 4_500;

  isOpen = false;
  isStreaming = false;
  showThought = false;
  draft = '';
  messages: AssistantChatMessage[] = [];
  copiedMessageIndex: number | null = null;
  feedbackCommentFor: AssistantChatMessage | null = null;
  feedbackComment = '';

  private shouldScroll = false;
  private streamSubscription: Subscription | null = null;
  private activeAssistantMessage: AssistantChatMessage | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly assistant: AssistantService,
    private readonly context: AssistantContextService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.visible$ = this.auth.currentUser$.pipe(
      map(u => !!u?.permissions?.includes(PermissionCodes.assistantUse))
    );
    this.context$ = this.context.ctx$;
    this.suggestions$ = this.context.ctx$.pipe(
      map(ctx => this.suggestionsFor(ctx.screen))
    );

    timer(700, AssistantBubbleComponent.THOUGHT_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.flashThought());

    this.context.open$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.open());
  }

  open(): void {
    if (this.isOpen) {
      setTimeout(() => this.composerRef?.nativeElement.focus());
      return;
    }
    this.toggle();
    this.cdr.markForCheck();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollRef) {
      this.scrollRef.nativeElement.scrollTop = this.scrollRef.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.shouldScroll = true;
      setTimeout(() => this.composerRef?.nativeElement.focus());
    }
  }

  close(): void {
    this.isOpen = false;
    setTimeout(() => this.launcherRef?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.isStreaming) {
      return;
    }

    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        this.messages[i].options = undefined;
        this.messages[i].suggestions = undefined;
        break;
      }
    }
    this.feedbackCommentFor = null;

    this.messages = [...this.messages, { role: 'user', content: text }];
    this.draft = '';
    const assistantMsg: AssistantChatMessage = { role: 'assistant', content: '' };
    this.messages = [...this.messages, assistantMsg];
    this.activeAssistantMessage = assistantMsg;
    this.isStreaming = true;
    this.shouldScroll = true;
    this.resetComposerHeight();
    this.cdr.markForCheck();

    const history = this.messages.filter(m => m.content !== '' || m === assistantMsg);
    const payload = history
      .filter(m => m !== assistantMsg)
      .map(m => ({ role: m.role, content: m.content }));

    this.streamSubscription = this.assistant
      .chat(payload, this.context.snapshot())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ev => {
          if (ev.type === 'delta') {
            assistantMsg.content += ev.text;
            this.shouldScroll = true;
          } else if (ev.type === 'options') {
            assistantMsg.options = ev.options;
            this.shouldScroll = true;
          } else if (ev.type === 'suggestions') {
            assistantMsg.suggestions = ev.suggestions;
            this.shouldScroll = true;
          } else if (ev.type === 'usage') {
            assistantMsg.requestId = ev.usage.requestId;
          } else if (ev.type === 'error') {
            assistantMsg.content += assistantMsg.content
              ? `\n\nNo pude completar la respuesta: ${ev.message}`
              : `No pude completar la respuesta: ${ev.message}`;
          } else if (ev.type === 'done') {
            if (this.activeAssistantMessage === assistantMsg) {
              this.isStreaming = false;
              if (!assistantMsg.content) {
                assistantMsg.content = 'No recibí una respuesta. Probá reformulando la consulta.';
              }
              this.activeAssistantMessage = null;
              this.streamSubscription?.unsubscribe();
              this.streamSubscription = null;
            }
          }
          this.cdr.markForCheck();
        },
        complete: () => {
          if (this.activeAssistantMessage === assistantMsg) {
            this.isStreaming = false;
            this.streamSubscription = null;
            this.activeAssistantMessage = null;
          }
          if (!assistantMsg.content) {
            assistantMsg.content = 'No recibí una respuesta. Probá reformulando la consulta.';
          }
          this.cdr.markForCheck();
        }
      });
  }

  askSuggestion(text: string): void {
    if (this.isStreaming) {
      return;
    }
    this.draft = text;
    this.send();
  }

  pickOption(option: string): void {
    this.askSuggestion(option);
  }

  rate(m: AssistantChatMessage, rating: 1 | -1): void {
    if (m.requestId === undefined) {
      return;
    }
    const previous = m.rating;
    m.rating = rating;
    if (rating === -1) {
      this.feedbackCommentFor = m;
      this.feedbackComment = '';
    } else if (this.feedbackCommentFor === m) {
      this.feedbackCommentFor = null;
    }
    this.cdr.markForCheck();

    this.assistant
      .sendFeedback(m.requestId, rating)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          m.rating = previous;
          if (this.feedbackCommentFor === m) {
            this.feedbackCommentFor = null;
          }
          this.cdr.markForCheck();
        }
      });
  }

  submitFeedbackComment(): void {
    const m = this.feedbackCommentFor;
    const comment = this.feedbackComment.trim();
    this.feedbackCommentFor = null;
    this.feedbackComment = '';
    this.cdr.markForCheck();
    if (!m || m.requestId === undefined || m.rating !== -1 || !comment) {
      return;
    }
    this.assistant
      .sendFeedback(m.requestId, -1, comment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  dismissFeedbackComment(): void {
    this.feedbackCommentFor = null;
    this.feedbackComment = '';
    this.cdr.markForCheck();
  }

  stop(): void {
    if (!this.isStreaming) {
      return;
    }
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = null;
    this.isStreaming = false;
    if (this.activeAssistantMessage && !this.activeAssistantMessage.content) {
      this.activeAssistantMessage.content = 'Respuesta detenida.';
    }
    this.activeAssistantMessage = null;
    this.cdr.markForCheck();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  onDraftInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }

  async copyMessage(content: string, index: number): Promise<void> {
    if (!content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      this.copiedMessageIndex = index;
      this.cdr.markForCheck();
      setTimeout(() => {
        if (this.copiedMessageIndex === index) {
          this.copiedMessageIndex = null;
          this.cdr.markForCheck();
        }
      }, 1800);
    } catch {
      this.copiedMessageIndex = null;
    }
  }

  hasScreenData(context: ScreenContext): boolean {
    return context.data !== undefined && context.data !== null;
  }

  trackMessage(index: number): number {
    return index;
  }

  clear(): void {
    this.stop();
    this.messages = [];
    this.draft = '';
    this.feedbackCommentFor = null;
    this.feedbackComment = '';
    this.resetComposerHeight();
    this.cdr.markForCheck();
  }

  private flashThought(): void {
    if (this.isOpen) {
      return;
    }
    this.showThought = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.showThought = false;
      this.cdr.markForCheck();
    }, AssistantBubbleComponent.THOUGHT_VISIBLE_MS);
  }

  private resetComposerHeight(): void {
    if (this.composerRef) {
      this.composerRef.nativeElement.style.height = 'auto';
    }
  }

  private suggestionsFor(screen?: string): string[] {
    const label = (screen ?? '').toLocaleLowerCase('es-AR');
    if (label.includes('ventas')) {
      return [
        '¿Qué resultado se destaca en este período?',
        'Compará ventas, costo y margen.',
        '¿Hay alguna anomalía que debería revisar?'
      ];
    }
    if (label.includes('medios de pago')) {
      return [
        '¿Cuál es el medio de pago más utilizado?',
        'Compará los cobros entre sucursales.',
        '¿Qué patrón relevante ves en estos datos?'
      ];
    }
    if (label.includes('stock')) {
      return [
        'Resumí los movimientos más importantes.',
        '¿Hay variaciones de stock inusuales?',
        '¿Qué productos debería revisar primero?'
      ];
    }
    return [
      'Resumí lo más importante de esta pantalla.',
      '¿Qué dato debería revisar primero?',
      'Detectá algo fuera de lo normal.'
    ];
  }
}
