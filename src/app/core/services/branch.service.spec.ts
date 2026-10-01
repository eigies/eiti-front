import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { formatPointOfSale } from '../models/branch.models';
import { BranchService } from './branch.service';

describe('BranchService', () => {
  let service: BranchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BranchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asigna el punto de venta por su propio endpoint', () => {
    service.setFiscalPointOfSale('branch-a', { number: 3 }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/branches/branch-a/fiscal-point-of-sale`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ number: 3 });
    request.flush({});
  });

  it('quitar el punto de venta manda null', () => {
    service.setFiscalPointOfSale('branch-a', { number: null }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/branches/branch-a/fiscal-point-of-sale`);
    expect(request.request.body).toEqual({ number: null });
    request.flush({});
  });

  it('muestra el punto de venta con 5 digitos como en el comprobante', () => {
    expect(formatPointOfSale(3)).toBe('00003');
    expect(formatPointOfSale(12345)).toBe('12345');
  });
});
