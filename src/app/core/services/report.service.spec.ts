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

// Un filtro no sirve si se queda en el formulario: cada reporte tiene que mandarlo en la URL.
describe('ReportService · filtros de los reportes', () => {
    const base = `${environment.apiUrl}/reports`;
    const period = 'dateFrom=2026-10-01&dateTo=2026-10-30';
    const dates = { dateFrom: '2026-10-01', dateTo: '2026-10-30' };

    let service: ReportService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
        service = TestBed.inject(ReportService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('control diario manda estado, sucursal, cliente y tipo de venta', () => {
        service.dailySalesControl({ ...dates, status: 2, branchId: 'b-1', customerId: 'c-1', saleType: 'retail' }).subscribe();

        http.expectOne(`${base}/sales/daily-control?${period}&status=2&branchId=b-1&customerId=c-1&saleType=retail`).flush({});
    });

    it('control diario sin filtros manda solo el estado', () => {
        service.dailySalesControl({ ...dates, status: 0, branchId: null, customerId: null, saleType: 'all' }).subscribe();

        http.expectOne(`${base}/sales/daily-control?${period}&status=0`).flush({});
    });

    it('canjes manda el tipo de venta', () => {
        service.tradeInsByBranch({ ...dates, saleType: 'wholesale' }).subscribe();

        http.expectOne(`${base}/sales/trade-ins-by-branch?${period}&saleType=wholesale`).flush({});
    });

    it('canjes con Todas no manda el tipo', () => {
        service.tradeInsByBranch({ ...dates, saleType: 'all' }).subscribe();

        http.expectOne(`${base}/sales/trade-ins-by-branch?${period}`).flush({});
    });

    it('descuentos manda el cliente y el tipo de venta', () => {
        service.getDiscountsReport({ ...dates, customerId: 'c-1', saleType: 'retail' }).subscribe();

        http.expectOne(`${base}/sales/discounts?${period}&customerId=c-1&saleType=retail`).flush({});
    });

    it('medios de pago manda el cliente', () => {
        service.paymentMethods(dates.dateFrom, dates.dateTo, undefined, 'all', 'c-1').subscribe();

        http.expectOne(`${base}/payments?${period}&customerId=c-1`).flush({});
    });

    it('caja manda la sucursal', () => {
        service.cashMovements(dates.dateFrom, dates.dateTo, 'b-1').subscribe();

        http.expectOne(`${base}/cash/movements?${period}&branchId=b-1`).flush({});
    });

    it('deudores manda la sucursal y el cliente', () => {
        service.customerDebtors({ branchId: 'b-1', customerId: 'c-1' }).subscribe();

        http.expectOne(`${base}/customers/debtors?branchId=b-1&customerId=c-1`).flush({});
    });

    it('deudores sin filtros pide el reporte completo', () => {
        service.customerDebtors().subscribe();

        http.expectOne(`${base}/customers/debtors`).flush({});
    });

    it('stock manda la sucursal', () => {
        service.stockMatrix('b-1').subscribe();

        http.expectOne(`${base}/stock-matrix?branchId=b-1`).flush({});
    });

    it('stock sin sucursal pide todas', () => {
        service.stockMatrix().subscribe();

        http.expectOne(`${base}/stock-matrix`).flush({});
    });
});
