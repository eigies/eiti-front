import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmationTone = 'danger' | 'warning' | 'neutral';

/** Un receptor fiscal en la comparacion del dialogo. */
export interface ConfirmationParty {
  /** Que es y de donde sale, ej. "Factura A 00010-00000039 · se emitio a". */
  caption: string;
  name: string;
  /** Ej. "CUIT: 30-68225650-4". Null para un consumidor final sin identificar. */
  identification: string | null;
  vatCondition: string;
  /** Que recibe si se confirma, ej. "Recibe la nota de credito". */
  note?: string;
}

/**
 * Dos receptores lado a lado antes de emitir un comprobante fiscal: el que lo recibe (primary) y el otro.
 * Los caracteres del documento que difieren se resaltan, para que se vea de un vistazo que no son el mismo.
 */
export interface ConfirmationComparison {
  primary: ConfirmationParty;
  secondary: ConfirmationParty;
}

export interface ConfirmationOptions {
  title: string;
  message: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  detail?: string;
  comparison?: ConfirmationComparison;
}

export interface ConfirmationDialogState extends Required<Omit<ConfirmationOptions, 'detail' | 'comparison'>> {
  detail: string | null;
  comparison: ConfirmationComparison | null;
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
        detail: options.detail ?? null,
        comparison: options.comparison ?? null
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
