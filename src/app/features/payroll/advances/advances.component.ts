import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { BranchService } from '../../../core/services/branch.service';
import { CashService } from '../../../core/services/cash.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { AuthService } from '../../../core/services/auth.service';
import { PayrollAdvanceService } from '../../../core/services/payroll-advance.service';
import { CashDrawerResponse, CashSessionResponse } from '../../../core/models/cash.models';
import { EmployeeResponse } from '../../../core/models/employee.models';
import { PAYROLL_PAYMENT_METHODS, PayrollAdvanceResponse, PayrollPaymentMethod } from '../../../core/models/payroll.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { ToastService } from '../../../shared/services/toast.service';

type CashDrawerOption = SearchableSelectOption & { drawer: CashDrawerResponse; branchName: string };

@Component({
  selector: 'app-advances',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './advances.component.html',
  styleUrls: ['./advances.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvancesComponent implements OnInit {
  readonly paymentMethods = PAYROLL_PAYMENT_METHODS;
  readonly permissionCodes = PermissionCodes;
  readonly statusOptions = [
    { value: 1, label: 'Pendiente' },
    { value: 2, label: 'Aplicado' },
    { value: 3, label: 'Cancelado' }
  ];

  employees: EmployeeResponse[] = [];
  advances: PayrollAdvanceResponse[] = [];
  cashDrawerOptions: CashDrawerOption[] = [];
  showCreate = false;
  loading = false;
  savingCreate = false;
  cancellingId: string | null = null;

  filterForm: FormGroup;
  createForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly employeesService: EmployeeService,
    private readonly advancesService: PayrollAdvanceService,
    private readonly branchService: BranchService,
    private readonly cashService: CashService,
    public readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly confirmation: ConfirmationService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      employeeId: [''],
      status: ['']
    });
    this.createForm = this.fb.group({
      employeeId: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [this.today(), Validators.required],
      notes: [''],
      paymentMethod: [1, Validators.required],
      cashDrawerId: ['']
    }, { validators: this.cashDrawerRequiredValidator });

    this.createForm.get('paymentMethod')?.valueChanges.subscribe(value => {
      if (Number(value) !== 1) {
        this.createForm.get('cashDrawerId')?.setValue('', { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadAdvances();
    this.loadCashDrawers();
  }

  get canManageAdvances(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollAdvancesManage);
  }

  get employeeOptions(): SearchableSelectOption[] {
    return this.employees.map(employee => ({
      value: employee.id,
      label: employee.fullName,
      meta: employee.employeeRoleName
    }));
  }

  get usesCash(): boolean {
    return Number(this.createForm.get('paymentMethod')?.value) === 1;
  }

  openCreateForm(): void {
    if (!this.canManageAdvances) return;
    this.showCreate = true;
    this.createForm.reset({
      employeeId: '',
      amount: null,
      date: this.today(),
      notes: '',
      paymentMethod: 1,
      cashDrawerId: this.cashDrawerOptions.length === 1 ? this.cashDrawerOptions[0].value : ''
    });
  }

  closeCreateForm(): void {
    if (this.savingCreate) return;
    this.showCreate = false;
  }

  applyFilters(): void {
    this.loadAdvances();
  }

  submitCreate(): void {
    if (!this.canManageAdvances || this.createForm.invalid || this.savingCreate) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.getRawValue();
    const paymentMethod = Number(raw.paymentMethod) as PayrollPaymentMethod;
    const cashDrawerId = String(raw.cashDrawerId || '');
    this.savingCreate = true;

    const cashSession$: Observable<CashSessionResponse | null> = paymentMethod === 1
      ? this.cashService.getCurrentSession(cashDrawerId)
      : of(null);

    cashSession$.pipe(
      switchMap(session => this.advancesService.create({
        employeeId: raw.employeeId,
        amount: Number(raw.amount),
        date: raw.date,
        notes: raw.notes?.trim() ? raw.notes.trim() : null,
        paymentMethod,
        cashSessionId: session?.id ?? null
      }))
    ).subscribe({
      next: created => {
        this.advances = [created, ...this.advances];
        this.savingCreate = false;
        this.showCreate = false;
        this.toast.success('Adelanto creado');
        this.cdr.markForCheck();
      },
      error: error => {
        this.savingCreate = false;
        this.toast.error(this.errorMessage(error, 'No se pudo crear el adelanto'));
        this.cdr.markForCheck();
      }
    });
  }

  async cancelAdvance(advance: PayrollAdvanceResponse): Promise<void> {
    if (!this.canManageAdvances || advance.status !== 1 || this.cancellingId) return;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Adelanto de sueldo',
      title: 'Cancelar adelanto',
      message: `Se cancelara el adelanto de ${this.employeeName(advance.employeeId)}.`,
      confirmLabel: 'Cancelar adelanto',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.cancellingId = advance.id;
    this.advancesService.cancel(advance.id).subscribe({
      next: updated => {
        this.replaceAdvance(updated);
        this.cancellingId = null;
        this.toast.success('Adelanto cancelado');
        this.cdr.markForCheck();
      },
      error: error => {
        this.cancellingId = null;
        this.toast.error(this.errorMessage(error, 'No se pudo cancelar el adelanto'));
        this.cdr.markForCheck();
      }
    });
  }

  employeeName(employeeId: string): string {
    return this.employees.find(employee => employee.id === employeeId)?.fullName ?? employeeId;
  }

  statusLabel(status: number): string {
    return this.statusOptions.find(option => option.value === status)?.label ?? 'Estado';
  }

  statusBadgeClass(status: number): string {
    if (status === 2) return 'badge badge--in';
    if (status === 3) return 'badge badge--out';
    return 'badge badge--pending';
  }

  wasCash(advance: PayrollAdvanceResponse): string {
    return advance.cashSessionId ? 'Efectivo' : 'No efectivo';
  }

  trackById(_index: number, advance: PayrollAdvanceResponse): string {
    return advance.id;
  }

  private loadEmployees(): void {
    this.employeesService.listEmployees().subscribe({
      next: employees => {
        this.employees = employees;
        this.cdr.markForCheck();
      },
      error: error => {
        this.toast.error(this.errorMessage(error, 'No se pudieron cargar los empleados'));
        this.cdr.markForCheck();
      }
    });
  }

  private loadAdvances(): void {
    const raw = this.filterForm.getRawValue();
    const employeeId = raw.employeeId || undefined;
    const status = raw.status ? Number(raw.status) : undefined;
    this.loading = true;
    this.advancesService.list(employeeId, status).subscribe({
      next: advances => {
        this.advances = advances;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.toast.error(this.errorMessage(error, 'No se pudieron cargar los adelantos'));
        this.cdr.markForCheck();
      }
    });
  }

  private loadCashDrawers(): void {
    this.branchService.listBranches().pipe(
      switchMap(branches => {
        if (branches.length === 0) return of([]);
        return forkJoin(branches.map(branch =>
          this.cashService.listCashDrawers(branch.id).pipe(
            switchMap(drawers => of(drawers.map(drawer => ({ drawer, branchName: branch.name }))))
          )
        ));
      })
    ).subscribe({
      next: groups => {
        const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? null;
        const canViewAll = this.auth.hasPermission(PermissionCodes.cashDrawerViewAll);
        this.cashDrawerOptions = groups.flat()
          .filter(item => item.drawer.isActive && item.drawer.hasOpenSession)
          .filter(item => canViewAll || !assignedId || item.drawer.id === assignedId)
          .map(item => ({
            value: item.drawer.id,
            label: item.drawer.name,
            meta: item.branchName,
            searchText: `${item.drawer.name} ${item.branchName}`,
            drawer: item.drawer,
            branchName: item.branchName
          }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.cashDrawerOptions = [];
        this.cdr.markForCheck();
      }
    });
  }

  private replaceAdvance(updated: PayrollAdvanceResponse): void {
    this.advances = this.advances.map(advance => advance.id === updated.id ? updated : advance);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private cashDrawerRequiredValidator(control: AbstractControl): ValidationErrors | null {
    const paymentMethod = Number(control.get('paymentMethod')?.value);
    const cashDrawerId = control.get('cashDrawerId')?.value;
    if (paymentMethod === 1 && !cashDrawerId) {
      return { cashDrawerRequired: true };
    }
    return null;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { detail?: string; message?: string; title?: string } } | null;
    return response?.error?.detail || response?.error?.message || response?.error?.title || fallback;
  }
}
