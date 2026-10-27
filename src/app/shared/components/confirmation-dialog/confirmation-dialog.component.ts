import { AsyncPipe, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmationService } from '../../services/confirmation.service';
import { TextSegment, diffSegments } from '../../utils/text-diff.util';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, NgTemplateOutlet],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  readonly state$ = this.confirmation.state$;

  private subscription?: Subscription;
  private previouslyFocused: HTMLElement | null = null;

  constructor(readonly confirmation: ConfirmationService) {}

  ngAfterViewInit(): void {
    this.subscription = this.state$.subscribe(dialog => {
      if (dialog) {
        this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.classList.add('confirmation-dialog-open');
        setTimeout(() => this.cancelButton?.nativeElement.focus());
        return;
      }

      document.body.classList.remove('confirmation-dialog-open');
      this.previouslyFocused?.focus();
      this.previouslyFocused = null;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    document.body.classList.remove('confirmation-dialog-open');
  }

  /** El documento de un receptor partido en tramos iguales / distintos al del otro. */
  segments(text: string, other: string | null): TextSegment[] {
    return diffSegments(text, other);
  }

  @HostListener('document:keydown.escape')
  cancelOnEscape(): void {
    this.confirmation.cancel();
  }
}
