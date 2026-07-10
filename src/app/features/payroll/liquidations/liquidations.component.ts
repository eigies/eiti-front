import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { BranchService } from '../../../core/services/branch.service';
import { CashService } from '../../../core/services/cash.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { AuthService } from '../../../core/services/auth.service';
import { PayrollLiquidationService } from '../../../core/services/payroll-liquidation.service';
import { CashDrawerResponse, CashSessionResponse } from '../../../core/models/cash.models';
import { EmployeeResponse } from '../../../core/models/employee.models';
import {
  GeneratePayrollPeriodResponse,
  PAYROLL_PAYMENT_METHODS,
  PAYROLL_PERIODICITIES,
  PayrollLiquidationResponse,
  PayrollPaymentMethod,
  PayrollPeriodicity
} from '../../../core/models/payroll.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { ToastService } from '../../../shared/services/toast.service';

type CashDrawerOption = SearchableSelectOption & { drawer: CashDrawerResponse; branchName: string };

@Component({
  selector: 'app-liquidations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './liquidations.component.html',
  styleUrls: ['./liquidations.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiquidationsComponent implements OnInit {
  readonly periodicities = PAYROLL_PERIODICITIES;
  readonly paymentMethods = PAYROLL_PAYMENT_METHODS;
  readonly permissionCodes = PermissionCodes;
  readonly statusOptions = [
    { value: 1, label: 'Pendiente' },
    { value: 2, label: 'Pagada' },
    { value: 3, label: 'Cancelada' }
  ];

  employees: EmployeeResponse[] = [];
  liquidations: PayrollLiquidationResponse[] = [];
  cashDrawerOptions: CashDrawerOption[] = [];
  page = 1;
  pageSize = 20;
  totalPages = 0;
  totalCount = 0;
  expandedId: string | null = null;
  showGenerate = false;
  generateResult: GeneratePayrollPeriodResponse | null = null;
  payTarget: PayrollLiquidationResponse | null = null;
  loading = false;
  generating = false;
  paying = false;
  cancellingId: string | null = null;

  filterForm: FormGroup;
  generateForm: FormGroup;
  payForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly employeesService: EmployeeService,
    private readonly liquidationsService: PayrollLiquidationService,
    private readonly branchService: BranchService,
    private readonly cashService: CashService,
    public readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly confirmation: ConfirmationService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      employeeId: [''],
      periodLabel: [''],
      status: ['']
    });
    const month = this.currentMonthLabel();
    this.generateForm = this.fb.group({
      periodicity: [1, Validators.required],
      periodLabel: [month, Validators.required],
      periodStart: [this.firstDayOfMonth(month), Validators.required],
      periodEnd: [this.lastDayOfMonth(month), Validators.required]
    });
    this.payForm = this.fb.group({
      paymentMethod: [1, Validators.required],
      cashDrawerId: ['']
    }, { validators: this.cashDrawerRequiredValidator });

    this.payForm.get('paymentMethod')?.valueChanges.subscribe(value => {
      if (Number(value) !== 1) {
        this.payForm.get('cashDrawerId')?.setValue('', { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadLiquidations();
    this.loadCashDrawers();
  }

  get canGenerate(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollLiquidationsGenerate);
  }

  get canPay(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollLiquidationsPay);
  }

  get employeeOptions(): SearchableSelectOption[] {
    return this.employees.map(employee => ({
      value: employee.id,
      label: employee.fullName,
      meta: employee.employeeRoleName
    }));
  }

  get usesCashForPay(): boolean {
    return Number(this.payForm.get('paymentMethod')?.value) === 1;
  }

  applyFilters(): void {
    this.page = 1;
    this.loadLiquidations();
  }

  openGenerateForm(): void {
    if (!this.canGenerate) return;
    this.showGenerate = true;
    this.generateResult = null;
    this.syncMonthlyPeriodDates();
  }

  closeGenerateForm(): void {
    if (this.generating) return;
    this.showGenerate = false;
  }

  syncMonthlyPeriodDates(): void {
    if (Number(this.generateForm.get('periodicity')?.value) !== 1) return;
    const label = String(this.generateForm.get('periodLabel')?.value || this.currentMonthLabel());
    this.generateForm.patchValue({
      periodStart: this.firstDayOfMonth(label),
      periodEnd: this.lastDayOfMonth(label)
    }, { emitEvent: false });
  }

  submitGenerate(): void {
    if (!this.canGenerate || this.generateForm.invalid || this.generating) {
      this.generateForm.markAllAsTouched();
      return;
    }

    const raw = this.generateForm.getRawValue();
    this.generating = true;
    this.liquidationsService.generate({
      periodicity: Number(raw.periodicity) as PayrollPeriodicity,
      periodLabel: raw.periodLabel,
      periodStart: raw.periodStart,
      periodEnd: raw.periodEnd
    }).subscribe({
      next: result => {
        this.generateResult = result;
        this.generating = false;
        this.toast.success('Liquidaciones generadas');
        this.loadLiquidations();
        this.cdr.markForCheck();
      },
      error: error => {
        this.generating = false;
        this.toast.error(this.errorMessage(error, 'No se pudieron generar las liquidaciones'));
        this.cdr.markForCheck();
      }
    });
  }

  openPayForm(liquidation: PayrollLiquidationResponse): void {
    if (!this.canPay || liquidation.status !== 1) return;
    this.payTarget = liquidation;
    this.payForm.reset({
      paymentMethod: 1,
      cashDrawerId: this.cashDrawerOptions.length === 1 ? this.cashDrawerOptions[0].value : ''
    });
  }

  closePayForm(): void {
    if (this.paying) return;
    this.payTarget = null;
  }

  submitPay(): void {
    if (!this.payTarget || !this.canPay || this.payForm.invalid || this.paying) {
      this.payForm.markAllAsTouched();
      return;
    }

    const raw = this.payForm.getRawValue();
    const paymentMethod = Number(raw.paymentMethod) as PayrollPaymentMethod;
    const cashDrawerId = String(raw.cashDrawerId || '');
    this.paying = true;

    const cashSession$: Observable<CashSessionResponse | null> = paymentMethod === 1
      ? this.cashService.getCurrentSession(cashDrawerId)
      : of(null);

    cashSession$.pipe(
      switchMap(session => this.liquidationsService.pay(this.payTarget!.id, {
        paymentMethod,
        cashSessionId: session?.id ?? null
      }))
    ).subscribe({
      next: updated => {
        this.replaceLiquidation(updated);
        this.paying = false;
        this.payTarget = null;
        this.toast.success('Liquidacion pagada');
        this.cdr.markForCheck();
      },
      error: error => {
        this.paying = false;
        this.toast.error(this.errorMessage(error, 'No se pudo pagar la liquidacion'));
        this.cdr.markForCheck();
      }
    });
  }

  async cancelLiquidation(liquidation: PayrollLiquidationResponse): Promise<void> {
    if (!this.canPay || liquidation.status === 3 || this.cancellingId) return;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Liquidacion de sueldo',
      title: 'Cancelar liquidacion',
      message: `Se cancelara la liquidacion de ${this.employeeName(liquidation.employeeId)}.`,
      confirmLabel: 'Cancelar liquidacion',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.cancellingId = liquidation.id;
    this.liquidationsService.cancel(liquidation.id).subscribe({
      next: updated => {
        this.replaceLiquidation(updated);
        this.cancellingId = null;
        this.toast.success('Liquidacion cancelada');
        this.cdr.markForCheck();
      },
      error: error => {
        this.cancellingId = null;
        this.toast.error(this.errorMessage(error, 'No se pudo cancelar la liquidacion'));
        this.cdr.markForCheck();
      }
    });
  }

  toggleDetail(liquidation: PayrollLiquidationResponse): void {
    this.expandedId = this.expandedId === liquidation.id ? null : liquidation.id;
  }

  previousPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadLiquidations();
  }

  nextPage(): void {
    if (this.totalPages > 0 && this.page >= this.totalPages) return;
    this.page++;
    this.loadLiquidations();
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

  paymentMethodLabel(value: number | null): string {
    if (!value) return '—';
    return this.paymentMethods.find(method => method.value === value)?.label ?? 'Otro';
  }

  lineTotal(lines: Array<{ amount: number }>): number {
    return lines.reduce((total, line) => total + Number(line.amount || 0), 0);
  }

  trackById(_index: number, liquidation: PayrollLiquidationResponse): string {
    return liquidation.id;
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

  private loadLiquidations(): void {
    const raw = this.filterForm.getRawValue();
    const filters: { employeeId?: string; periodLabel?: string; status?: number; page: number; pageSize: number } = {
      page: this.page,
      pageSize: this.pageSize
    };
    if (raw.employeeId) filters.employeeId = raw.employeeId;
    if (raw.periodLabel?.trim()) filters.periodLabel = raw.periodLabel.trim();
    if (raw.status) filters.status = Number(raw.status);

    this.loading = true;
    this.liquidationsService.list(filters).subscribe({
      next: response => {
        this.liquidations = response.items;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalCount = response.totalCount;
        this.totalPages = response.totalPages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.toast.error(this.errorMessage(error, 'No se pudieron cargar las liquidaciones'));
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

  private replaceLiquidation(updated: PayrollLiquidationResponse): void {
    this.liquidations = this.liquidations.map(item => item.id === updated.id ? updated : item);
  }

  private currentMonthLabel(): string {
    const date = new Date();
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}`;
  }

  private firstDayOfMonth(label: string): string {
    const [year, month] = label.split('-').map(Number);
    if (!year || !month) return '';
    return `${year}-${this.pad(month)}-01`;
  }

  private lastDayOfMonth(label: string): string {
    const [year, month] = label.split('-').map(Number);
    if (!year || !month) return '';
    return `${year}-${this.pad(month)}-${this.pad(new Date(year, month, 0).getDate())}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
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
