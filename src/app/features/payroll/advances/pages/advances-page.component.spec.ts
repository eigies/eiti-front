import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeService } from '../../../../core/services/employee.service';
import { PayrollAdvanceService } from '../../../../core/services/payroll-advance.service';
import { BranchService } from '../../../../core/services/branch.service';
import { CashService } from '../../../../core/services/cash.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ConfirmationService } from '../../../../shared/services/confirmation.service';
import { AdvancesFacade } from '../data-access/advances.facade';
import { AdvancesPageComponent } from './advances-page.component';

describe('AdvancesPageComponent', () => {
  let fixture: ComponentFixture<AdvancesPageComponent>;
  // El estado y las reglas viven en la facade; la página solo conecta.
  let component: AdvancesFacade;
  let advances: jasmine.SpyObj<PayrollAdvanceService>;

  beforeEach(async () => {
    const employees = jasmine.createSpyObj('EmployeeService', ['listEmployees']);
    advances = jasmine.createSpyObj('PayrollAdvanceService', ['list', 'create', 'cancel']);
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
    advances.list.and.returnValue(of([]));
    branches.listBranches.and.returnValue(of([]));
    auth.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [AdvancesPageComponent],
      providers: [
        { provide: EmployeeService, useValue: employees },
        { provide: PayrollAdvanceService, useValue: advances },
        { provide: BranchService, useValue: branches },
        { provide: CashService, useValue: cash },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: confirmation }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdvancesPageComponent);
    component = fixture.debugElement.injector.get(AdvancesFacade);
    fixture.detectChanges();
  });

  it('loads employees and advances on init', () => {
    expect(component.employeeName('employee-1')).toBe('Ana Lopez');
    expect(advances.list).toHaveBeenCalledWith(undefined, undefined);
  });

  it('sends transfer advances with null cash session', () => {
    advances.create.and.returnValue(of({
      id: 'advance-1',
      employeeId: 'employee-1',
      amount: 50,
      date: '2026-07-10',
      notes: null,
      status: 1,
      appliedToLiquidationId: null,
      cashSessionId: null
    }));
    component.openCreateForm();
    component.createForm.setValue({
      employeeId: 'employee-1',
      amount: 50,
      date: '2026-07-10',
      notes: '',
      paymentMethod: 2,
      cashDrawerId: ''
    });

    component.submitCreate();

    expect(advances.create).toHaveBeenCalledWith({
      employeeId: 'employee-1',
      amount: 50,
      date: '2026-07-10',
      notes: null,
      paymentMethod: 2,
      cashSessionId: null
    });
  });

  it('uses the searchable dropdown for every select-like payroll field', () => {
    component.openCreateForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.search-select__trigger').length).toBeGreaterThanOrEqual(2);
  });
});
