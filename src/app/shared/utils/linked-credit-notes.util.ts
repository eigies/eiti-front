import { ConfirmationOptions } from '../services/confirmation.service';
import { extractApiError } from './api-error.util';

/**
 * Codigos con los que el back frena la anulacion de una compra o una venta que tiene notas de credito vigentes
 * emitidas sobre ella. El mensaje las nombra con su importe; si el usuario confirma, se reenvia la anulacion con
 * cancelLinkedCreditNotes=true y se anulan todas juntas.
 */
const HAS_ACTIVE_CREDIT_NOTE = new Set(['Purchases.Cancel.HasActiveCreditNote', 'Sales.Cancel.HasActiveCreditNote']);

export function hasActiveLinkedCreditNotes(error: unknown): boolean {
  const code = (error as { error?: { errorCode?: string } } | null)?.error?.errorCode;
  return !!code && HAS_ACTIVE_CREDIT_NOTE.has(code);
}

/**
 * Antes de anular el comprobante junto con sus notas de credito, el usuario ve cuales se anulan (y por cuanto).
 * confirmLabel usa el verbo de cada pantalla ("Cancelar la compra...", "Anular la venta...").
 */
export function linkedCreditNotesConfirmation(error: unknown, confirmLabel: string): ConfirmationOptions {
  return {
    tone: 'danger',
    eyebrow: 'Notas de crédito vinculadas',
    title: 'También se anulan sus notas de crédito',
    message: extractApiError(error, 'El comprobante tiene notas de crédito vigentes.'),
    detail: 'La anulación de cada nota queda registrada en tu caja abierta. Si el saldo a favor no alcanza para revertirlas, no se anula nada.',
    confirmLabel,
    cancelLabel: 'Volver'
  };
}
