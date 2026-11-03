import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CustomerDebtorsResponse } from '../../../core/models/report.models';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DebtorsReportComponent } from './debtors-report.component';

describe('DebtorsReportComponent · filtros', () => {
  const response: CustomerDebtorsResponse = {
    rows: [{
      customerId: 'c-1', customerName: 'Ana Perez', openSalesCount: 1, oldestDate: '2026-10-01T12:00:00Z',
      owed: 100, creditBalance: 150, net: -50
    }],
    totalOwed: 100,
    totalCredit: 150,
    totalNet: -50
  };

  let fixture: ComponentFixture<DebtorsReportComponent>;
  let reports: jasmine.SpyObj<ReportService>;

  beforeEach(() => {
    reports = jasmine.createSpyObj<ReportService>('ReportService', ['customerDebtors']);
    reports.customerDebtors.and.returnValue(of(response));
    TestBed.configureTestingModule({
      imports: [DebtorsReportComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of([]) } },
        { provide: CustomerService, useValue: { listCustomers: () => of([]) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }
      ]
    });
    fixture = TestBed.createComponent(DebtorsReportComponent);
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('arranca sin filtros', () => {
    expect(reports.customerDebtors).toHaveBeenCalledWith({ branchId: null, customerId: null });
  });

  it('manda la sucursal y el cliente elegidos', () => {
    fixture.componentInstance.filterForm.patchValue({ branchId: 'b-1', customerId: 'c-1' });

    fixture.componentInstance.load();

    expect(reports.customerDebtors).toHaveBeenCalledWith({ branchId: 'b-1', customerId: 'c-1' });
  });

  it('Limpiar vuelve a todos', () => {
    fixture.componentInstance.filterForm.patchValue({ branchId: 'b-1', customerId: 'c-1' });

    fixture.componentInstance.clearFilters();

    expect(reports.customerDebtors.calls.mostRecent().args[0]).toEqual({ branchId: null, customerId: null });
  });

  function headers(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'))
      .map(th => (th.textContent ?? '').trim());
  }

  function filterByBranch(): void {
    fixture.componentInstance.filterForm.patchValue({ branchId: 'b-1' });
    fixture.componentInstance.load();
    fixture.detectChanges();
  }

  // El saldo a favor es del cliente: restado de la deuda de una sucursal da un Neto que no existe.
  it('con sucursal muestra solo lo adeudado y aclara por qué', () => {
    filterByBranch();

    expect(headers()).not.toContain('A favor');
    expect(headers()).not.toContain('Neto');
    expect(text()).toContain('el saldo a favor es del cliente');
  });

  it('sin sucursal muestra A favor y Neto, sin aclaración', () => {
    expect(headers()).toContain('A favor');
    expect(headers()).toContain('Neto');
    expect(text()).not.toContain('el saldo a favor es del cliente');
  });

  it('el Excel con sucursal tampoco lleva A favor ni Neto', () => {
    filterByBranch();

    expect(Object.keys(fixture.componentInstance.exportRows()[0])).toEqual(['Cliente', 'Ventas abiertas', 'Más antigua', 'Adeudado']);
  });

  it('el Excel sin sucursal lleva todas las columnas', () => {
    expect(Object.keys(fixture.componentInstance.exportRows()[0])).toContain('Neto');
  });
});
