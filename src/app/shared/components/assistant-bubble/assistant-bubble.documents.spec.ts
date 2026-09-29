import { ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AssistantFiscalDocument, AssistantStreamEvent } from '../../../core/models/assistant.models';
import { AssistantContextService } from '../../../core/services/assistant-context.service';
import { AssistantService } from '../../../core/services/assistant.service';
import { AuthService } from '../../../core/services/auth.service';
import { SaleService } from '../../../core/services/sale.service';
import { SaleInvoicePrintResponse } from '../../../core/models/sale.models';
import { InvoicePdfService } from '../../services/invoice-pdf.service';
import { ToastService } from '../../services/toast.service';
import { AssistantBubbleComponent } from './assistant-bubble.component';

const INVOICE: AssistantFiscalDocument = { saleId: 's1', saleCode: 'SUCU-123-179', kind: 'invoice', label: 'Factura A 00001-00000005' };
const CREDIT: AssistantFiscalDocument = { saleId: 's1', saleCode: 'SUCU-123-179', kind: 'creditNote', label: 'Nota de crédito A 00001-00000002' };

describe('AssistantBubbleComponent · comprobantes para descargar', () => {
  function setup(canInvoice = true) {
    const assistant = jasmine.createSpyObj<AssistantService>('AssistantService', ['chat', 'uploadStatement', 'sendFeedback']);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission'], { currentUser$: new BehaviorSubject(null) });
    auth.hasPermission.and.callFake(code => canInvoice && code === 'sales.invoice');
    const context = jasmine.createSpyObj<AssistantContextService>('AssistantContextService', ['snapshot'], {
      ctx$: new BehaviorSubject({}), open$: new Subject<void>()
    });
    context.snapshot.and.returnValue({});
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['getInvoicePrint', 'getCreditNotePrint']);
    const pdf = jasmine.createSpyObj<InvoicePdfService>('InvoicePdfService', ['generate']);
    pdf.generate.and.resolveTo();
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    TestBed.configureTestingModule({
      providers: [
        { provide: SaleService, useValue: sales },
        { provide: InvoicePdfService, useValue: pdf },
        { provide: ToastService, useValue: toast }
      ]
    });
    const component = TestBed.runInInjectionContext(() => new AssistantBubbleComponent(auth, assistant, context, cdr));
    return { component, assistant, sales, pdf, toast };
  }

  it('cuelga del mensaje del asistente los comprobantes que manda el agente', () => {
    const { component, assistant } = setup();
    const events: AssistantStreamEvent[] = [
      { type: 'delta', text: 'Está anulada.' },
      { type: 'documents', documents: [INVOICE, CREDIT] },
      { type: 'done' }
    ];
    assistant.chat.and.returnValue(of(...events));

    component.draft = '¿la SUCU-123-179 está facturada?';
    component.send();

    const answer = component.messages[component.messages.length - 1];
    expect(answer.documents).toEqual([INVOICE, CREDIT]);
  });

  it('descarga la nota de crédito con el PDF de siempre', async () => {
    const { component, sales, pdf } = setup();
    const print = { letter: 'A' } as SaleInvoicePrintResponse;
    sales.getCreditNotePrint.and.returnValue(of(print));

    component.downloadDocument(CREDIT);
    await Promise.resolve();

    expect(sales.getCreditNotePrint).toHaveBeenCalledWith('s1');
    expect(sales.getInvoicePrint).not.toHaveBeenCalled();
    expect(pdf.generate).toHaveBeenCalledWith(print);
  });

  it('no dispara otra descarga mientras hay una en curso', () => {
    const { component, sales } = setup();
    sales.getInvoicePrint.and.returnValue(new Subject<SaleInvoicePrintResponse>());

    component.downloadDocument(INVOICE);
    component.downloadDocument(INVOICE);

    expect(sales.getInvoicePrint).toHaveBeenCalledTimes(1);
    expect(component.downloadingDocument).toBe(INVOICE);
  });

  it('avisa con un toast claro si EITI no devuelve el comprobante', () => {
    const { component, sales, toast } = setup();
    sales.getInvoicePrint.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.downloadDocument(INVOICE);

    expect(toast.error).toHaveBeenCalledWith('No se pudo obtener la factura de la venta SUCU-123-179.');
    expect(component.downloadingDocument).toBeNull();
  });

  it('sin permiso de facturar no ofrece las descargas', () => {
    expect(setup(false).component.canDownloadInvoices).toBeFalse();
  });

  it('con permiso de facturar ofrece las descargas', () => {
    expect(setup(true).component.canDownloadInvoices).toBeTrue();
  });
});
