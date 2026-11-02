import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WholesaleByCustomerComponent } from './wholesale-by-customer.component';
import { ReportService } from '../../../core/services/report.service';
import { CustomerService } from '../../../core/services/customer.service';
import { BranchService } from '../../../core/services/branch.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../shared/services/pdf-layout.service';
import { WholesaleByCustomerResponse } from '../../../core/models/report.models';

// Ventas por cliente sirve tambien para minoristas: los clientes que vuelven a comprar, con su ultima compra,
// y las ventas sin cliente juntas en Consumidor final, al final y atenuadas.
describe('WholesaleByCustomerComponent · ventas por cliente', () => {
    let fixture: ComponentFixture<WholesaleByCustomerComponent>;
    let reportSpy: jasmine.SpyObj<ReportService>;

    function response(saleType: string): WholesaleByCustomerResponse {
        const row = { units: 1, revenue: 100000, avgTicket: 100000, ccPending: 0, cost: 70000, profit: 30000, marginPct: 30 };
        return {
            saleType,
            rows: [
                { ...row, customerId: 'c1', customerName: 'Taller Ruiz', operations: 3, lastSaleAt: '2026-10-21T13:30:00Z' },
                { ...row, customerId: null, customerName: '(Consumidor final)', operations: 40, lastSaleAt: '2026-10-30T19:00:00Z' }
            ],
            totals: { operations: 43, units: 2, revenue: 200000, avgTicket: 4651.16, ccPending: 0, cost: 140000, profit: 60000, marginPct: 30 }
        };
    }

    function render(saleType: string): HTMLElement {
        reportSpy.wholesaleByCustomer.and.returnValue(of(response(saleType)));
        fixture = TestBed.createComponent(WholesaleByCustomerComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    function headers(el: HTMLElement): string[] {
        return Array.from(el.querySelectorAll('thead th')).map(th => (th.textContent ?? '').trim());
    }

    beforeEach(() => {
        reportSpy = jasmine.createSpyObj<ReportService>('ReportService', ['wholesaleByCustomer']);
        const customers = jasmine.createSpyObj<CustomerService>('CustomerService', ['listCustomers']);
        customers.listCustomers.and.returnValue(of([]));
        const branches = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
        branches.listBranches.and.returnValue(of([]));

        TestBed.configureTestingModule({
            imports: [WholesaleByCustomerComponent],
            providers: [
                { provide: ReportService, useValue: reportSpy },
                { provide: CustomerService, useValue: customers },
                { provide: BranchService, useValue: branches },
                { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
                { provide: PdfBrandingService, useValue: {} },
                { provide: PdfLayoutService, useValue: {} }
            ]
        });
    });

    it('se llama "Ventas por cliente"', () => {
        const el = render('wholesale');

        expect(el.querySelector('h1')?.textContent?.trim()).toBe('Ventas por cliente');
    });

    it('el tipo de venta está a la vista, al lado de las fechas', () => {
        const el = render('wholesale');

        expect(el.querySelector('.filter-form__primary app-searchable-select[formcontrolname="saleType"]')).not.toBeNull();
    });

    it('el tipo de venta no cuenta como filtro adicional', () => {
        render('retail');
        fixture.componentInstance.filterForm.patchValue({ saleType: 'retail' });

        expect(fixture.componentInstance.activeOptionalFiltersCount).toBe(0);
    });

    it('muestra la última compra de cada cliente', () => {
        const el = render('retail');

        expect(headers(el)).toContain('Última compra');
        const firstRow = el.querySelector('tbody tr') as HTMLElement;
        expect(firstRow.textContent).toContain(new Date('2026-10-21T13:30:00Z').toLocaleDateString('es-AR', { dateStyle: 'short' }));
    });

    it('en Minorista no muestra el saldo de cuenta corriente', () => {
        expect(headers(render('retail'))).not.toContain('Saldo CC');
    });

    it('en Mayorista sigue mostrando el saldo de cuenta corriente', () => {
        expect(headers(render('wholesale'))).toContain('Saldo CC');
    });

    it('consumidor final se ve atenuado', () => {
        const el = render('retail');
        const rows = Array.from(el.querySelectorAll('tbody tr'));

        expect(rows[0].classList).not.toContain('dim');
        expect(rows[1].classList).toContain('dim');
    });
});
