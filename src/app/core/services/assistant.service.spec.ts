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
});
