import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { formatCuit } from '../models/fiscal-settings.models';
import { FiscalSettingsService } from './fiscal-settings.service';

describe('FiscalSettingsService', () => {
  let service: FiscalSettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(FiscalSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga un punto de venta con su sucursal', () => {
    service.createPointOfSale({ number: 3, branchId: 'branch-a' }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/fiscal-settings/points-of-sale`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ number: 3, branchId: 'branch-a' });
    request.flush({});
  });

  it('dejar libre un punto de venta manda branchId null', () => {
    service.assignPointOfSale('pv-1', null).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/fiscal-settings/points-of-sale/pv-1/branch`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ branchId: null });
    request.flush({});
  });

  it('muestra el CUIT con guiones', () => {
    expect(formatCuit('20397583857')).toBe('20-39758385-7');
  });
});
