import { ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY, of, Subject, throwError } from 'rxjs';
import { StatementSummary } from '../../../core/models/assistant.models';
import { AssistantContextService } from '../../../core/services/assistant-context.service';
import { AssistantService } from '../../../core/services/assistant.service';
import { AuthService } from '../../../core/services/auth.service';
import { SaleService } from '../../../core/services/sale.service';
import { InvoicePdfService } from '../../services/invoice-pdf.service';
import { ToastService } from '../../services/toast.service';
import { AssistantBubbleComponent } from './assistant-bubble.component';

const SUMMARY: StatementSummary = {
  statementId: 7, fileName: 'mp.csv', movements: 3, creditsCount: 2, creditsTotal: 100000,
  debitsCount: 1, debitsTotal: -120, periodFrom: '01/09/2026', periodTo: '30/09/2026', skippedRows: 0,
  bankDetected: 'Mercado Pago', bankId: 3, bankOptions: [], balanceStatus: 'ok'
};

describe('AssistantBubbleComponent · extractos adjuntos', () => {
  function setup() {
    const assistant = jasmine.createSpyObj<AssistantService>('AssistantService', ['chat', 'uploadStatement', 'sendFeedback']);
    assistant.chat.and.returnValue(EMPTY);
    const auth = { currentUser$: new BehaviorSubject(null) } as unknown as AuthService;
    const context = jasmine.createSpyObj<AssistantContextService>('AssistantContextService', ['snapshot'], {
      ctx$: new BehaviorSubject({}), open$: new Subject<void>()
    });
    context.snapshot.and.returnValue({});
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    TestBed.configureTestingModule({
      providers: [
        { provide: SaleService, useValue: jasmine.createSpyObj<SaleService>('SaleService', ['getInvoicePrint', 'getCreditNotePrint']) },
        { provide: InvoicePdfService, useValue: jasmine.createSpyObj<InvoicePdfService>('InvoicePdfService', ['generate']) },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['error']) }
      ]
    });
    const component = TestBed.runInInjectionContext(() => new AssistantBubbleComponent(auth, assistant, context, cdr));
    return { component, assistant };
  }

  const csv = (bytes = 10) => new File([new Uint8Array(bytes)], 'mp.csv', { type: 'text/csv' });

  it('sube el archivo y muestra su resumen en la conversación', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValue(of(SUMMARY));

    component.attachFile(csv());

    expect(assistant.uploadStatement).toHaveBeenCalled();
    const card = component.messages[component.messages.length - 1].attachment!;
    expect(card.status).toBe('ready');
    expect(card.summary).toEqual(SUMMARY);
    expect(component.activeAttachments.map(a => a.statementId)).toEqual([7]);
  });

  it('rechaza archivos de más de 10 MB sin subirlos', () => {
    const { component, assistant } = setup();

    component.attachFile(csv(10 * 1024 * 1024 + 1));

    expect(assistant.uploadStatement).not.toHaveBeenCalled();
    const card = component.messages[component.messages.length - 1].attachment!;
    expect(card.status).toBe('error');
    expect(card.error).toContain('10 MB');
  });

  it('muestra el detalle que devuelve el agente cuando no puede leer el archivo', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { detail: 'No encontré movimientos en el archivo.' }
    })));

    component.attachFile(csv());

    const card = component.messages[component.messages.length - 1].attachment!;
    expect(card.status).toBe('error');
    expect(card.error).toBe('No encontré movimientos en el archivo.');
    expect(component.activeAttachments).toEqual([]);
  });

  it('el siguiente mensaje lleva el extracto activo, y deja de llevarlo al quitarlo', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValue(of(SUMMARY));
    component.attachFile(csv());

    component.draft = 'conciliá este extracto';
    component.send();
    expect(assistant.chat.calls.mostRecent().args[2]).toEqual([7]);

    component.detachAttachment(7);
    component.draft = 'otra cosa';
    component.send();
    expect(assistant.chat.calls.mostRecent().args[2]).toEqual([]);
  });

  it('la tarjeta del adjunto no viaja como mensaje en el historial', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValue(of(SUMMARY));
    component.attachFile(csv());

    component.draft = 'conciliá este extracto';
    component.send();

    const history = assistant.chat.calls.mostRecent().args[0];
    expect(history).toEqual([{ role: 'user', content: 'conciliá este extracto' }]);
  });

  it('varias capturas se acumulan y viajan juntas; se pueden quitar de a una', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValues(of(SUMMARY), of({ ...SUMMARY, statementId: 8, fileName: 'captura2.jpg' }));
    component.attachFile(csv());
    component.attachFile(csv());

    component.draft = 'conciliá las dos del 23/9';
    component.send();
    expect(assistant.chat.calls.mostRecent().args[2]).toEqual([7, 8]);

    component.detachAttachment(7);
    component.draft = 'y solo la segunda';
    component.send();
    expect(assistant.chat.calls.mostRecent().args[2]).toEqual([8]);
  });

  it('elegir varios archivos a la vez los sube todos', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValues(of(SUMMARY), of({ ...SUMMARY, statementId: 8 }));
    const files = new DataTransfer();
    files.items.add(csv());
    files.items.add(csv());
    const input = document.createElement('input');
    input.type = 'file';
    input.files = files.files;

    component.onFileSelected({ target: input } as unknown as Event);

    expect(assistant.uploadStatement).toHaveBeenCalledTimes(2);
    expect(component.activeAttachments.map(a => a.statementId)).toEqual([7, 8]);
  });

  it('limpiar la conversación suelta los adjuntos', () => {
    const { component, assistant } = setup();
    assistant.uploadStatement.and.returnValue(of(SUMMARY));
    component.attachFile(csv());

    component.clear();

    expect(component.activeAttachments).toEqual([]);
  });
});
