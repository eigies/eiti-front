import { SaleInvoicingStatus } from '../../core/models/sale.models';
import { canDownloadSaleCreditNote, canDownloadSaleDebitNote, canDownloadSaleInvoice } from './sale-fiscal-documents.util';

describe('sale-fiscal-documents', () => {
  // [estado de facturación, factura, nota de crédito]
  const cases: [SaleInvoicingStatus | null | undefined, boolean, boolean][] = [
    [null, false, false],
    [undefined, false, false],
    [1, false, false],
    [2, false, false],
    [3, true, false],
    [4, false, false],
    [5, true, true]
  ];

  cases.forEach(([status, invoice, creditNote]) => {
    it(`estado ${status}: factura ${invoice}, nota de crédito ${creditNote}`, () => {
      expect(canDownloadSaleInvoice(status)).toBe(invoice);
      expect(canDownloadSaleCreditNote(status)).toBe(creditNote);
    });
  });

  it('la nota de débito se descarga solo autorizada', () => {
    expect(canDownloadSaleDebitNote(3)).toBeTrue();
    const others: (SaleInvoicingStatus | null | undefined)[] = [null, undefined, 1, 2, 4, 5];
    others.forEach(status => expect(canDownloadSaleDebitNote(status)).toBeFalse());
  });
});
