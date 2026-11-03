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

  // El saldo a favor no está repartido por sucursal: sin aclararlo, Neto parece de esa sucursal.
  it('con sucursal aclara que A favor es el saldo total del cliente', () => {
    fixture.componentInstance.filterForm.patchValue({ branchId: 'b-1' });

    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(text()).toContain('saldo total del cliente');
  });

  it('sin sucursal no muestra la aclaración', () => {
    expect(text()).not.toContain('saldo total del cliente');
  });
});
