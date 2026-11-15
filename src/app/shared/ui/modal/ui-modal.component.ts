import { NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

export type UiModalSize = 'sm' | 'md' | 'lg';
export type UiModalTone = 'default' | 'danger';

let nextModalId = 0;

/**
 * Popup EITI 2: fondo que se oscurece y ventana que sube (entra 180 ms, sale 120 ms).
 * En las confirmaciones irreversibles, tocar afuera sacude la ventana en vez de cerrarla.
 * El pie se proyecta con el atributo `uiModalFoot`.
 */
@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [NgIf],
  templateUrl: './ui-modal.component.html',
  styleUrls: ['./ui-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiModalComponent implements AfterViewInit, OnDestroy {
  @Input() eyebrow = '';
  @Input() heading = '';
  @Input() sub = '';
  @Input() size: UiModalSize = 'md';
  @Input() tone: UiModalTone = 'default';
  /** Tocar afuera sacude en lugar de cerrar (confirmaciones que no se pueden deshacer). */
  @Input() irreversible = false;
  /** Escape cierra el popup. */
  @Input() closable = true;
  /** Muestra la X del encabezado. */
  @Input() showClose = true;
  @Input() width: string | null = null;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLElement>;

  readonly titleId = `ui-modal-title-${++nextModalId}`;
  leaving = false;
  shaking = false;

  private previouslyFocused: HTMLElement | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTimeout(() => {
      const root = this.dialog.nativeElement;
      const target = root.querySelector<HTMLElement>('[autofocus]')
        ?? root.querySelector<HTMLElement>('.ui-modal__body input:not([disabled]), .ui-modal__body select:not([disabled]), .ui-modal__body textarea:not([disabled])')
        ?? root.querySelector<HTMLElement>('.ui-modal__foot button:not([disabled])');
      (target ?? root).focus();
    });
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  onBackdrop(): void {
    if (this.irreversible) {
      this.shaking = false;
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.shaking = true;
        this.cdr.markForCheck();
      });
      return;
    }
    this.close();
  }

  close(): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.cdr.markForCheck();
    setTimeout(() => this.closed.emit(), 120);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.closable) {
      this.close();
    }
  }
}
