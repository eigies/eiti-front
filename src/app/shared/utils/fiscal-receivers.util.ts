import { SaleFiscalReceiver, SaleFiscalReceiversResponse } from '../../core/models/sale.models';
import { ConfirmationOptions, ConfirmationParty } from '../services/confirmation.service';

/**
 * Codigos con los que el back frena una nota de credito porque la factura se emitio a otro receptor que el de
 * la ficha actual del cliente: hay que mostrarle los dos al usuario y reenviar confirmando.
 */
const INVOICE_RECEIVER_CHANGED = new Set(['Sales.Cancel.InvoiceReceiverChanged', 'Sales.CreditNote.InvoiceReceiverChanged']);

export function isInvoiceReceiverChanged(error: unknown): boolean {
  const code = (error as { error?: { errorCode?: string } } | null)?.error?.errorCode;
  return !!code && INVOICE_RECEIVER_CHANGED.has(code);
}

/** "CUIT 30-68225650-4", o el nombre si el receptor no tiene documento. */
export function receiverLabel(receiver: SaleFiscalReceiver): string {
  return receiver.identification ? receiver.identification.replace(': ', ' ') : receiver.name;
}

export type CreditNoteAction = 'cancel' | 'retry';

/**
 * La factura se emitio a un receptor y la ficha hoy dice otro: la NC va al de la factura. Se confirma viendo
 * los dos, nunca en silencio.
 */
export function creditNoteReceiverConfirmation(
  receivers: SaleFiscalReceiversResponse,
  action: CreditNoteAction
): ConfirmationOptions {
  const invoice = receivers.invoice!;
  return {
    tone: 'warning',
    eyebrow: 'Nota de crédito',
    title: 'La factura salió a otro CUIT',
    message: 'La ficha del cliente cambió después de facturar. La nota de crédito anula esa factura, así que va al mismo receptor al que se emitió.',
    comparison: {
      primary: party(invoice, `${invoice.document} · se emitió a`, 'Recibe la nota de crédito'),
      secondary: party(receivers.customer, 'Ficha del cliente hoy', 'No se usa en esta nota de crédito')
    },
    detail: 'Si el CUIT correcto es el de la ficha, volvé y revisalo con el cliente antes de seguir.',
    confirmLabel: action === 'cancel'
      ? `Anular y emitir la NC a ${receiverLabel(invoice)}`
      : `Emitir la NC a ${receiverLabel(invoice)}`,
    cancelLabel: 'Volver'
  };
}

/**
 * Regularizar una NC que salio a otro receptor que el de su factura: ND a ese receptor (la deja sin efecto) y
 * NC nueva al de la factura. Son comprobantes fiscales que no se deshacen.
 */
export function regularizationConfirmation(receivers: SaleFiscalReceiversResponse): ConfirmationOptions {
  const invoice = receivers.invoice!;
  const pendingCreditNoteOnly = receivers.regularizationStep === 'creditNote';
  const wrong = receivers.creditNote ?? receivers.debitNote;

  return {
    tone: 'danger',
    eyebrow: 'Regularizar nota de crédito',
    title: pendingCreditNoteOnly ? 'Falta la nota de crédito correcta' : 'La nota de crédito salió a otro CUIT',
    message: pendingCreditNoteOnly
      ? 'La nota de débito ya dejó sin efecto la nota de crédito anterior. Falta emitir la nota de crédito al receptor de la factura.'
      : 'Se emite una nota de débito al CUIT de esa nota de crédito, que la deja sin efecto, y una nota de crédito nueva al CUIT de la factura.',
    comparison: wrong
      ? {
        primary: party(invoice, `${invoice.document} · se emitió a`, 'Recibe la nota de crédito nueva'),
        secondary: party(wrong, `${wrong.document} · salió a`, pendingCreditNoteOnly ? 'Ya recibió la nota de débito' : 'Recibe la nota de débito')
      }
      : undefined,
    detail: 'Son comprobantes fiscales autorizados por ARCA: no se pueden deshacer.',
    confirmLabel: pendingCreditNoteOnly ? 'Emitir la nota de crédito' : 'Emitir nota de débito y nota de crédito',
    cancelLabel: 'Volver'
  };
}

function party(receiver: SaleFiscalReceiver, caption: string, note: string): ConfirmationParty {
  return {
    caption,
    name: receiver.name,
    identification: receiver.identification,
    vatCondition: receiver.vatCondition,
    note
  };
}
