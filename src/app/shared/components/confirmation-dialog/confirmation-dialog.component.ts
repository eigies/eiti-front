import { AsyncPipe, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmationService } from '../../services/confirmation.service';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [AsyncPipe, NgIf],
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

  @HostListener('document:keydown.escape')
  cancelOnEscape(): void {
    this.confirmation.cancel();
  }
}
