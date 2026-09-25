import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  let service: AssistantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manda la consulta junto al pulgar abajo', () => {
    service.sendFeedback(12, -1, 'inventó productos', '¿qué filtros de aceite tengo?').subscribe();

    const request = http.expectOne(`${environment.agentApiUrl}/feedback`);
    expect(request.request.body).toEqual({
      request_id: 12,
      rating: -1,
      comment: 'inventó productos',
      question: '¿qué filtros de aceite tengo?'
    });
    request.flush(null);
  });

  it('no manda la consulta con el pulgar arriba', () => {
    service.sendFeedback(12, 1, undefined, '¿qué filtros de aceite tengo?').subscribe();

    const request = http.expectOne(`${environment.agentApiUrl}/feedback`);
    expect(request.request.body).toEqual({ request_id: 12, rating: 1 });
    request.flush(null);
  });

  it('recorta la consulta a 2000 caracteres', () => {
    service.sendFeedback(12, -1, undefined, 'x'.repeat(2500)).subscribe();

    const request = http.expectOne(`${environment.agentApiUrl}/feedback`);
    expect((request.request.body as { question: string }).question.length).toBe(2000);
    request.flush(null);
  });

  it('sube el extracto como multipart y mapea el resumen', () => {
    const file = new File(['a;b'], 'mp.csv', { type: 'text/csv' });
    let summary: unknown;
    service.uploadStatement(file).subscribe(s => (summary = s));

    const request = http.expectOne(`${environment.agentApiUrl}/statements`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    const sent = (request.request.body as FormData).get('file') as File;
    expect([sent.name, sent.size]).toEqual(['mp.csv', file.size]);
    request.flush({
      statement_id: 7, file_name: 'mp.csv', movements: 3, credits_count: 2, credits_total: '100000.00',
      debits_count: 1, debits_total: '-120.00', period_from: '01/09/2026', period_to: '30/09/2026',
      skipped_rows: 0, bank_detected: 'Mercado Pago', bank_id: 3, bank_options: [{ id: 3, name: 'Mercadopago' }],
      balance_check: { status: 'mismatch', expected_closing: '1', computed_closing: '2' }
    });

    expect(summary).toEqual({
      statementId: 7, fileName: 'mp.csv', movements: 3, creditsCount: 2, creditsTotal: 100000,
      debitsCount: 1, debitsTotal: -120, periodFrom: '01/09/2026', periodTo: '30/09/2026', skippedRows: 0,
      bankDetected: 'Mercado Pago', bankId: 3, bankOptions: [{ id: 3, name: 'Mercadopago' }], balanceStatus: 'mismatch'
    });
  });

  it('manda los adjuntos activos en el cuerpo del chat', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 200 }));
    await new Promise<void>(resolve => service.chat([], null, [7]).subscribe({ complete: () => resolve() }));
    const body = JSON.parse(fetchSpy.calls.mostRecent().args[1]!.body as string);
    expect(body.attachments).toEqual([7]);
  });
});
