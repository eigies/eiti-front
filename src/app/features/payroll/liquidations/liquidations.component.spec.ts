import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeService } from '../../../core/services/employee.service';
import { PayrollLiquidationService } from '../../../core/services/payroll-liquidation.service';
import { BranchService } from '../../../core/services/branch.service';
import { CashService } from '../../../core/services/cash.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../shared/services/pdf-layout.service';
import { LiquidationsComponent } from './liquidations.component';

describe('LiquidationsComponent', () => {
  let fixture: ComponentFixture<LiquidationsComponent>;
  let component: LiquidationsComponent;
  let liquidations: jasmine.SpyObj<PayrollLiquidationService>;

  beforeEach(async () => {
    const employees = jasmine.createSpyObj('EmployeeService', ['listEmployees']);
    liquidations = jasmine.createSpyObj('PayrollLiquidationService', ['list', 'generate', 'pay', 'cancel']);
    const branches = jasmine.createSpyObj('BranchService', ['listBranches']);
    const cash = jasmine.createSpyObj('CashService', ['listCashDrawers', 'getCurrentSession']);
    const auth = jasmine.createSpyObj('AuthService', ['hasPermission'], { currentUser: { assignedCashDrawerId: 'drawer-1' } });
    const toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    const confirmation = jasmine.createSpyObj('ConfirmationService', ['confirm']);
    const pdfBranding = jasmine.createSpyObj('PdfBrandingService', ['prepare', 'drawWatermark', 'drawHeader', 'drawFooter']);
    const pdfLayout = jasmine.createSpyObj('PdfLayoutService', ['resolveColumns', 'drawTableHeader', 'drawTableRow', 'ensurePageSpace']);

    employees.listEmployees.and.returnValue(of([
      {
        id: 'employee-1',
        firstName: 'Ana',
        lastName: 'Lopez',
        fullName: 'Ana Lopez',
        employeeRole: 1,
        employeeRoleName: 'Administrativo',
        baseSalary: 1000,
        payrollPeriodicity: 1,
        isActive: true,
        createdAt: '2026-07-10'
      }
    ]));
    liquidations.list.and.returnValue(of({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    branches.listBranches.and.returnValue(of([]));
    auth.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [LiquidationsComponent],
      providers: [
        { provide: EmployeeService, useValue: employees },
        { provide: PayrollLiquidationService, useValue: liquidations },
        { provide: BranchService, useValue: branches },
        { provide: CashService, useValue: cash },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: PdfBrandingService, useValue: pdfBranding },
        { provide: PdfLayoutService, useValue: pdfLayout }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LiquidationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads employees and paged liquidations on init', () => {
    expect(component.employeeName('employee-1')).toBe('Ana Lopez');
    expect(liquidations.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('generates a payroll period and stores the result summary', () => {
    liquidations.generate.and.returnValue(of({ generatedCount: 1, generated: [], skipped: [] }));
    component.openGenerateForm();
    component.generateForm.setValue({
      periodicity: 1,
      periodLabel: '2026-07',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31'
    });

    component.submitGenerate();

    expect(liquidations.generate).toHaveBeenCalledWith({
      periodicity: 1,
      periodLabel: '2026-07',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31'
    });
    expect(component.generateResult?.generatedCount).toBe(1);
  });

  it('exposes receipt PDF export for a liquidation', () => {
    expect(typeof component.exportReceiptPdf).toBe('function');
  });

  it('uses the searchable dropdown for every select-like payroll field', () => {
    component.openGenerateForm();
    component.payTarget = {
      id: 'liq-1',
      employeeId: 'employee-1',
      periodLabel: '2026-07',
      grossAmount: 1000,
      netAmount: 900,
      status: 1,
      paymentMethod: null,
      paidAt: null,
      deductionLines: [],
      advanceLines: [],
      bonusLines: []
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.search-select__trigger').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the receipt action separated from the net total in the detail panel', () => {
    const paidLiquidation = {
      id: 'liq-1',
      employeeId: 'employee-1',
      periodLabel: '2026-07',
      grossAmount: 1000,
      netAmount: 900,
      status: 2,
      paymentMethod: 2,
      paidAt: '2026-07-10T12:00:00Z',
      deductionLines: [],
      advanceLines: [],
      bonusLines: []
    };
    liquidations.list.and.returnValue(of({
      items: [paidLiquidation],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1
    }));
    component.applyFilters();
    component.expandedId = 'liq-1';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.receipt-actions')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.total-line--net')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.total-line--net .receipt-btn')).toBeNull();
  });
});
