import { SALE_INVOICING_STATUS, SaleInvoicingStatus } from '../../core/models/sale.models';

// Cuándo existe un comprobante autorizado para descargar. Lo usan Gestión de Ventas y la cuenta corriente.

/** Una factura anulada sigue teniendo comprobante: se puede reimprimir. */
export function canDownloadSaleInvoice(invoicingStatus: SaleInvoicingStatus | null | undefined): boolean {
  return invoicingStatus === SALE_INVOICING_STATUS.invoiced || invoicingStatus === SALE_INVOICING_STATUS.voided;
}

/** La venta anulada tiene su nota de crédito autorizada: se puede descargar. */
export function canDownloadSaleCreditNote(invoicingStatus: SaleInvoicingStatus | null | undefined): boolean {
  return invoicingStatus === SALE_INVOICING_STATUS.voided;
}

/** La nota de débito de una regularización existe solo una vez autorizada. */
export function canDownloadSaleDebitNote(debitNoteStatus: SaleInvoicingStatus | null | undefined): boolean {
  return debitNoteStatus === SALE_INVOICING_STATUS.invoiced;
}
