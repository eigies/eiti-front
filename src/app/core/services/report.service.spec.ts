import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ReportService } from './report.service';

describe('ReportService · descuentos', () => {
    let service: ReportService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
        service = TestBed.inject(ReportService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('manda el rango de fechas y los filtros elegidos', () => {
        service.getDiscountsReport({ dateFrom: '2026-10-01', dateTo: '2026-10-30', branchId: 'b-1', userId: 'u-1' }).subscribe();

        const request = http.expectOne(
            `${environment.apiUrl}/reports/sales/discounts?dateFrom=2026-10-01&dateTo=2026-10-30&branchId=b-1&userId=u-1`);
        expect(request.request.method).toBe('GET');
        request.flush({ rows: [], totals: { salesCount: 0, discountAmount: 0 } });
    });

    it('sin sucursal ni usuario no los manda', () => {
        service.getDiscountsReport({ dateFrom: '2026-10-01', dateTo: '2026-10-30', branchId: null, userId: null }).subscribe();

        const request = http.expectOne(`${environment.apiUrl}/reports/sales/discounts?dateFrom=2026-10-01&dateTo=2026-10-30`);
        expect(request.request.url).not.toMatch(/branchId|userId/);
        request.flush({ rows: [], totals: { salesCount: 0, discountAmount: 0 } });
    });
});
