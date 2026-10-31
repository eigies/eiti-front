import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SaleInvoicePrintResponse } from '../../core/models/sale.models';
import { SaleService } from '../../core/services/sale.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { SaleFiscalPdfService } from './sale-fiscal-pdf.service';
import { ToastService } from './toast.service';

describe('SaleFiscalPdfService', () => {
  const print = { kind: 'invoice', number: 15 } as SaleInvoicePrintResponse;

  function setup() {
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['getInvoicePrint', 'getCreditNotePrint', 'getDebitNotePrint']);
    sales.getInvoicePrint.and.returnValue(of(print));
    sales.getCreditNotePrint.and.returnValue(of(print));
    sales.getDebitNotePrint.and.returnValue(of(print));
    const pdf = jasmine.createSpyObj<InvoicePdfService>('InvoicePdfService', ['generate']);
    pdf.generate.and.resolveTo();
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    return { sales, pdf, toast, service: new SaleFiscalPdfService(sales, pdf, toast) };
  }

  it('la factura se pide al print de factura y se genera con ese comprobante', () => {
    const { sales, pdf, service } = setup();
    service.download('sale-1', 'invoice');
    expect(sales.getInvoicePrint).toHaveBeenCalledWith('sale-1');
    expect(pdf.generate).toHaveBeenCalledWith(print);
  });

  it('la nota de crédito y la de débito usan su propio print', () => {
    const { sales, service } = setup();
    service.download('sale-1', 'creditNote');
    service.download('sale-2', 'debitNote');
    expect(sales.getCreditNotePrint).toHaveBeenCalledWith('sale-1');
    expect(sales.getDebitNotePrint).toHaveBeenCalledWith('sale-2');
    expect(sales.getInvoicePrint).not.toHaveBeenCalled();
  });

  it('si el back rechaza, muestra su detalle y no genera el PDF', () => {
    const { sales, pdf, toast, service } = setup();
    sales.getInvoicePrint.and.returnValue(throwError(() => ({ error: { detail: 'La venta no tiene factura.' } })));
    service.download('sale-1', 'invoice');
    expect(toast.error).toHaveBeenCalledWith('La venta no tiene factura.');
    expect(pdf.generate).not.toHaveBeenCalled();
  });

  it('si el back falla sin detalle, usa el mensaje del comprobante', () => {
    const { sales, toast, service } = setup();
    sales.getCreditNotePrint.and.returnValue(throwError(() => ({ status: 0 })));
    service.download('sale-1', 'creditNote');
    expect(toast.error).toHaveBeenCalledWith('No se pudo obtener la nota de crédito.');
  });

  it('si falla la generación del PDF, avisa', fakeAsync(() => {
    const { pdf, toast, service } = setup();
    pdf.generate.and.rejectWith(new Error('logo'));
    service.download('sale-1', 'debitNote');
    flushMicrotasks();
    expect(toast.error).toHaveBeenCalledWith('No se pudo generar el PDF de la nota de débito.');
  }));
});
