import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeService } from '../../../core/services/employee.service';
import { PayrollLiquidationService } from '../../../core/services/payroll-liquidation.service';
import { BranchService } from '../../../core/services/branch.service';
import { CashService } from '../../../core/services/cash.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
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
        { provide: ConfirmationService, useValue: confirmation }
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
});
