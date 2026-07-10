import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { EmployeeResponse } from '../../core/models/employee.models';
import { PAYROLL_PERIODICITIES, PayrollPeriodicity } from '../../core/models/payroll.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { AuthService } from '../../core/services/auth.service';
import { EmployeePayrollConfigService } from '../../core/services/employee-payroll-config.service';
import { EmployeeService } from '../../core/services/employee.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeesComponent implements OnInit {
  readonly periodicities = PAYROLL_PERIODICITIES;
  readonly permissionCodes = PermissionCodes;

  employees: EmployeeResponse[] = [];
  selectedEmployee: EmployeeResponse | null = null;
  payrollForm: FormGroup;
  loading = false;
  savingPayroll = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly employeeService: EmployeeService,
    private readonly payrollConfig: EmployeePayrollConfigService,
    public readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.payrollForm = this.fb.group({
      baseSalary: [null, [Validators.min(0)]],
      payrollPeriodicity: [null]
    }, { validators: this.payrollConfigValidator });

    this.payrollForm.get('baseSalary')?.valueChanges.subscribe(value => {
      if (value === null || value === '') {
        this.payrollForm.get('payrollPeriodicity')?.setValue(null, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.loadEmployees();
  }

  get canManagePayroll(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollManage);
  }

  loadEmployees(): void {
    this.loading = true;
    this.employeeService.listEmployees().subscribe({
      next: employees => {
        this.employees = employees;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.toast.error(this.errorMessage(error, 'No se pudieron cargar los empleados'));
        this.cdr.markForCheck();
      }
    });
  }

  openPayrollConfig(employee: EmployeeResponse): void {
    if (!this.canManagePayroll) return;
    this.selectedEmployee = employee;
    this.payrollForm.reset({
      baseSalary: employee.baseSalary,
      payrollPeriodicity: employee.payrollPeriodicity
    });
  }

  closePayrollConfig(): void {
    if (this.savingPayroll) return;
    this.selectedEmployee = null;
    this.payrollForm.reset({ baseSalary: null, payrollPeriodicity: null });
  }

  savePayrollConfig(): void {
    if (!this.selectedEmployee || this.payrollForm.invalid || this.savingPayroll) {
      this.payrollForm.markAllAsTouched();
      return;
    }

    const raw = this.payrollForm.getRawValue();
    const baseSalary = raw.baseSalary === null || raw.baseSalary === '' ? null : Number(raw.baseSalary);
    const payrollPeriodicity = baseSalary === null ? null : Number(raw.payrollPeriodicity) as PayrollPeriodicity;
    const employeeId = this.selectedEmployee.id;

    this.savingPayroll = true;
    this.payrollConfig.set(employeeId, { baseSalary, payrollPeriodicity }).subscribe({
      next: response => {
        this.employees = this.employees.map(employee =>
          employee.id === response.employeeId
            ? { ...employee, baseSalary: response.baseSalary, payrollPeriodicity: response.payrollPeriodicity }
            : employee
        );
        this.savingPayroll = false;
        this.selectedEmployee = null;
        this.toast.success('Configuracion salarial actualizada');
        this.cdr.markForCheck();
      },
      error: error => {
        this.savingPayroll = false;
        this.toast.error(this.errorMessage(error, 'No se pudo actualizar la configuracion salarial'));
        this.cdr.markForCheck();
      }
    });
  }

  periodicityLabel(value: number | null): string {
    return this.periodicities.find(option => option.value === value)?.label ?? '—';
  }

  trackById(_index: number, employee: EmployeeResponse): string {
    return employee.id;
  }

  private payrollConfigValidator(control: AbstractControl): ValidationErrors | null {
    const baseSalary = control.get('baseSalary')?.value;
    const periodicity = control.get('payrollPeriodicity')?.value;
    if (baseSalary !== null && baseSalary !== '' && !periodicity) {
      return { payrollPeriodicityRequired: true };
    }
    return null;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { detail?: string; message?: string } } | null;
    return response?.error?.detail || response?.error?.message || fallback;
  }
}
