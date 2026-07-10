import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PermissionCodes } from '../../core/models/permission.models';
import { EmployeePayrollConfigService } from '../../core/services/employee-payroll-config.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { EmployeesComponent } from './employees.component';

describe('EmployeesComponent', () => {
  let fixture: ComponentFixture<EmployeesComponent>;
  let component: EmployeesComponent;
  let employeeService: jasmine.SpyObj<EmployeeService>;
  let payrollConfig: jasmine.SpyObj<EmployeePayrollConfigService>;
  let auth: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    employeeService = jasmine.createSpyObj('EmployeeService', ['listEmployees']);
    payrollConfig = jasmine.createSpyObj('EmployeePayrollConfigService', ['set']);
    auth = jasmine.createSpyObj('AuthService', ['hasPermission']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);

    employeeService.listEmployees.and.returnValue(of([
      {
        id: 'employee-1',
        firstName: 'Ana',
        lastName: 'Lopez',
        fullName: 'Ana Lopez',
        employeeRole: 1,
        employeeRoleName: 'Administrativo',
        baseSalary: null,
        payrollPeriodicity: null,
        isActive: true,
        createdAt: '2026-07-10'
      }
    ]));
    auth.hasPermission.and.callFake(permission => permission === PermissionCodes.payrollManage);

    await TestBed.configureTestingModule({
      imports: [EmployeesComponent],
      providers: [
        { provide: EmployeeService, useValue: employeeService },
        { provide: EmployeePayrollConfigService, useValue: payrollConfig },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads employees and exposes payroll columns', () => {
    expect(employeeService.listEmployees).toHaveBeenCalled();
    expect(component.employees[0].baseSalary).toBeNull();
    expect(component.periodicityLabel(null)).toBe('—');
  });

  it('requires periodicity only when base salary is set', () => {
    component.openPayrollConfig(component.employees[0]);
    component.payrollForm.patchValue({ baseSalary: 1000, payrollPeriodicity: null });

    expect(component.payrollForm.invalid).toBeTrue();

    component.payrollForm.patchValue({ baseSalary: null, payrollPeriodicity: null });

    expect(component.payrollForm.valid).toBeTrue();
  });

  it('saves payroll config and updates the employee row', () => {
    component.openPayrollConfig(component.employees[0]);
    component.payrollForm.setValue({ baseSalary: 1000, payrollPeriodicity: 1 });
    payrollConfig.set.and.returnValue(of({ employeeId: 'employee-1', baseSalary: 1000, payrollPeriodicity: 1 }));

    component.savePayrollConfig();

    expect(payrollConfig.set).toHaveBeenCalledWith('employee-1', { baseSalary: 1000, payrollPeriodicity: 1 });
    expect(component.employees[0].baseSalary).toBe(1000);
    expect(component.employees[0].payrollPeriodicity).toBe(1);
    expect(toast.success).toHaveBeenCalledWith('Configuracion salarial actualizada');
  });
});
