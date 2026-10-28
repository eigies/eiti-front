import { SaleFiscalReceiversResponse } from '../../core/models/sale.models';
import {
  creditNoteReceiverConfirmation,
  isInvoiceReceiverChanged,
  receiverLabel,
  regularizationConfirmation
} from './fiscal-receivers.util';

// MAT-3705: factura a 30-68225650-4; la ficha (y la NC) a 30-51743143-1.
function receivers(partial: Partial<SaleFiscalReceiversResponse> = {}): SaleFiscalReceiversResponse {
  return {
    available: true,
    unavailableReason: null,
    invoice: {
      document: 'Factura A 00010-00000039', name: 'TRANSPORTE OLIVOS S.A -',
      vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-68225650-4'
    },
    customer: {
      document: null, name: 'TRANSPORTE OLIVOS S.A -',
      vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-51743143-1'
    },
    customerMatchesInvoice: false,
    creditNote: null,
    creditNoteMatchesInvoice: true,
    regularizationStep: 'none',
    debitNote: null,
    ...partial
  };
}

describe('fiscal-receivers', () => {
  it('reconoce los dos codigos con los que el back pide confirmar el receptor', () => {
    expect(isInvoiceReceiverChanged({ error: { errorCode: 'Sales.Cancel.InvoiceReceiverChanged' } })).toBeTrue();
    expect(isInvoiceReceiverChanged({ error: { errorCode: 'Sales.CreditNote.InvoiceReceiverChanged' } })).toBeTrue();
    expect(isInvoiceReceiverChanged({ error: { errorCode: 'Sales.Cancel.RefundModeRequired' } })).toBeFalse();
    expect(isInvoiceReceiverChanged(null)).toBeFalse();
  });

  it('el CUIT del boton es el de la factura, sin los dos puntos', () => {
    expect(receiverLabel(receivers().invoice!)).toBe('CUIT 30-68225650-4');
  });

  it('al anular, la NC va al receptor de la factura y la ficha queda como referencia', () => {
    const options = creditNoteReceiverConfirmation(receivers(), 'cancel');

    expect(options.confirmLabel?.replace(/⁠/g, '')).toBe('Anular y emitir la NC a CUIT 30-68225650-4');
    expect(options.comparison?.primary.identification).toBe('CUIT: 30-68225650-4');
    expect(options.comparison?.primary.note).toBe('Recibe la nota de crédito');
    expect(options.comparison?.secondary.identification).toBe('CUIT: 30-51743143-1');
  });

  it('el boton no parte el CUIT en dos renglones', () => {
    expect(creditNoteReceiverConfirmation(receivers(), 'retry').confirmLabel)
      .toBe('Emitir la NC a CUIT 30-⁠68225650-⁠4');
  });

  it('regularizar compara la factura con la NC mal emitida y avisa que no se deshace', () => {
    const options = regularizationConfirmation(receivers({
      creditNote: {
        document: 'Nota de crédito A 00010-00000004', name: 'TRANSPORTE OLIVOS S.A -',
        vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-51743143-1'
      },
      creditNoteMatchesInvoice: false,
      regularizationStep: 'debitNote'
    }));

    expect(options.tone).toBe('danger');
    expect(options.confirmLabel).toBe('Emitir nota de débito y nota de crédito');
    expect(options.comparison?.secondary.caption).toBe('Nota de crédito A 00010-00000004 · salió a');
    expect(options.comparison?.secondary.note).toBe('Recibe la nota de débito');
  });

  it('si la nota de debito ya salio, solo falta la nota de credito', () => {
    const options = regularizationConfirmation(receivers({
      debitNote: {
        document: 'Nota de débito A 00010-00000001', name: 'TRANSPORTE OLIVOS S.A -',
        vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-51743143-1'
      },
      regularizationStep: 'creditNote'
    }));

    expect(options.confirmLabel).toBe('Emitir la nota de crédito');
    expect(options.comparison?.secondary.note).toBe('Ya recibió la nota de débito');
  });
});
