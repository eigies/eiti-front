import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envia el rango y la sucursal al endpoint agregado', () => {
    service.getSummary('2026-08-01', '2026-08-31', 'branch-a').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/dashboard/summary?dateFrom=2026-08-01&dateTo=2026-08-31&branchId=branch-a`
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('omite branchId cuando se consultan todas las sucursales', () => {
    service.getSummary('2026-08-01', '2026-08-31', null).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/dashboard/summary?dateFrom=2026-08-01&dateTo=2026-08-31`
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('carga el detalle desde dashboard sin depender de sales.access', () => {
    service.listSales('2026-08-15', '2026-08-15', 'branch-a').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/dashboard/sales?dateFrom=2026-08-15&dateTo=2026-08-15&branchId=branch-a`
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
