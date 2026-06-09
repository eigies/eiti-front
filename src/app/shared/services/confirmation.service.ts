import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmationTone = 'danger' | 'warning' | 'neutral';

export interface ConfirmationOptions {
  title: string;
  message: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  detail?: string;
}

export interface ConfirmationDialogState extends Required<Omit<ConfirmationOptions, 'detail'>> {
  detail: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly stateSubject = new BehaviorSubject<ConfirmationDialogState | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  private resolver: ((confirmed: boolean) => void) | null = null;

  confirm(options: ConfirmationOptions): Promise<boolean> {
    if (this.resolver) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.stateSubject.next({
        title: options.title,
        message: options.message,
        eyebrow: options.eyebrow ?? 'Confirmacion requerida',
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Volver',
        tone: options.tone ?? 'warning',
        detail: options.detail ?? null
      });
    });
  }

  accept(): void {
    this.close(true);
  }

  cancel(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.stateSubject.next(null);
    resolve?.(confirmed);
  }
}
