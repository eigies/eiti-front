import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SaleFiscalDocumentKind, SaleInvoicePrintResponse } from '../../core/models/sale.models';
import { SaleService } from '../../core/services/sale.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { ToastService } from './toast.service';

interface FiscalPdfSource {
  fetch: (saleId: string) => Observable<SaleInvoicePrintResponse>;
  fetchError: string;
  generateError: string;
}

/**
 * Descarga el PDF de un comprobante fiscal de una venta. Es el mismo PDF desde cualquier pantalla
 * (Gestión de Ventas, cuenta corriente): pide los datos autorizados y los dibuja con el diseño de EITI.
 */
@Injectable({ providedIn: 'root' })
export class SaleFiscalPdfService {
  private readonly sources: Record<SaleFiscalDocumentKind, FiscalPdfSource>;

  constructor(
    private readonly saleService: SaleService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly toast: ToastService
  ) {
    this.sources = {
      invoice: {
        fetch: id => this.saleService.getInvoicePrint(id),
        fetchError: 'No se pudo obtener la factura.',
        generateError: 'No se pudo generar el PDF de la factura.'
      },
      creditNote: {
        fetch: id => this.saleService.getCreditNotePrint(id),
        fetchError: 'No se pudo obtener la nota de crédito.',
        generateError: 'No se pudo generar el PDF de la nota de crédito.'
      },
      debitNote: {
        fetch: id => this.saleService.getDebitNotePrint(id),
        fetchError: 'No se pudo obtener la nota de débito.',
        generateError: 'No se pudo generar el PDF de la nota de débito.'
      }
    };
  }

  download(saleId: string, kind: SaleFiscalDocumentKind): void {
    const source = this.sources[kind];
    source.fetch(saleId).subscribe({
      next: print => this.invoicePdf.generate(print)
        .catch(() => this.toast.error(source.generateError)),
      error: (error: { error?: { detail?: string } } | null) =>
        this.toast.error(error?.error?.detail ?? source.fetchError)
    });
  }
}
