import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmployeeService } from '../../../core/services/employee.service';
import { AuthService } from '../../../core/services/auth.service';
import { PayrollBonusService } from '../../../core/services/payroll-bonus.service';
import { PayrollBonusConceptService } from '../../../core/services/payroll-bonus-concept.service';
import { EmployeeResponse } from '../../../core/models/employee.models';
import { BonusConceptResponse, PAYROLL_BONUS_AMOUNT_TYPES, PayrollBonusAmountType, PayrollBonusResponse } from '../../../core/models/payroll.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-bonuses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './bonuses.component.html',
  styleUrls: ['./bonuses.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BonusesComponent implements OnInit {
  readonly amountTypes = PAYROLL_BONUS_AMOUNT_TYPES;
  readonly permissionCodes = PermissionCodes;
  readonly statusOptions = [
    { value: 1, label: 'Pendiente' },
    { value: 2, label: 'Aplicado' },
    { value: 3, label: 'Cancelado' }
  ];

  employees: EmployeeResponse[] = [];
  concepts: BonusConceptResponse[] = [];
  bonuses: PayrollBonusResponse[] = [];
  showCreate = false;
  loading = false;
  savingCreate = false;
  cancellingId: string | null = null;

  filterForm: FormGroup;
  createForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly employeesService: EmployeeService,
    private readonly bonusesService: PayrollBonusService,
    private readonly conceptsService: PayrollBonusConceptService,
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
      conceptId: ['', Validators.required],
      amountType: [1, Validators.required],
      value: [null, [Validators.required, Validators.min(0.01)]],
      notes: ['']
    });

    this.createForm.get('amountType')?.valueChanges.subscribe(() => this.cdr.markForCheck());
    this.createForm.get('employeeId')?.valueChanges.subscribe(() => this.cdr.markForCheck());
    this.createForm.get('value')?.valueChanges.subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadConcepts();
    this.loadBonuses();
  }

  get canManageBonuses(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollManage);
  }

  get employeeOptions(): SearchableSelectOption[] {
    return this.employees.map(employee => ({
      value: employee.id,
      label: employee.fullName,
      meta: employee.employeeRoleName
    }));
  }

  get conceptOptions(): SearchableSelectOption[] {
    return this.concepts.filter(c => c.isActive).map(concept => ({
      value: concept.id,
      label: concept.name
    }));
  }

  get isPercentage(): boolean {
    return Number(this.createForm.get('amountType')?.value) === 2;
  }

  get percentagePreview(): string | null {
    if (!this.isPercentage) return null;
    const employeeId = this.createForm.get('employeeId')?.value;
    const value = Number(this.createForm.get('value')?.value);
    const employee = this.employees.find(e => e.id === employeeId);
    if (!employee || !employee.baseSalary || !value || value <= 0) return null;
    const amount = (employee.baseSalary * value) / 100;
    return `≈ ${amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })} sobre un sueldo base de ${employee.baseSalary.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })}`;
  }

  openCreateForm(): void {
    if (!this.canManageBonuses) return;
    this.showCreate = true;
    this.createForm.reset({
      employeeId: '',
      conceptId: '',
      amountType: 1,
      value: null,
      notes: ''
    });
  }

  closeCreateForm(): void {
    if (this.savingCreate) return;
    this.showCreate = false;
  }

  applyFilters(): void {
    this.loadBonuses();
  }

  submitCreate(): void {
    if (!this.canManageBonuses || this.createForm.invalid || this.savingCreate) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.getRawValue();
    this.savingCreate = true;

    this.bonusesService.create({
      employeeId: raw.employeeId,
      conceptId: raw.conceptId,
      amountType: Number(raw.amountType) as PayrollBonusAmountType,
      value: Number(raw.value),
      notes: raw.notes?.trim() ? raw.notes.trim() : null
    }).subscribe({
      next: created => {
        this.bonuses = [created, ...this.bonuses];
        this.savingCreate = false;
        this.showCreate = false;
        this.toast.success('Bonificación creada');
        this.cdr.markForCheck();
      },
      error: error => {
        this.savingCreate = false;
        this.toast.error(this.errorMessage(error, 'No se pudo crear la bonificación'));
        this.cdr.markForCheck();
      }
    });
  }

  async cancelBonus(bonus: PayrollBonusResponse): Promise<void> {
    if (!this.canManageBonuses || bonus.status !== 1 || this.cancellingId) return;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Bonificación de sueldo',
      title: 'Cancelar bonificación',
      message: `Se cancelará la bonificación de ${this.employeeName(bonus.employeeId)}.`,
      confirmLabel: 'Cancelar bonificación',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.cancellingId = bonus.id;
    this.bonusesService.cancel(bonus.id).subscribe({
      next: updated => {
        this.replaceBonus(updated);
        this.cancellingId = null;
        this.toast.success('Bonificación cancelada');
        this.cdr.markForCheck();
      },
      error: error => {
        this.cancellingId = null;
        this.toast.error(this.errorMessage(error, 'No se pudo cancelar la bonificación'));
        this.cdr.markForCheck();
      }
    });
  }

  employeeName(employeeId: string): string {
    return this.employees.find(employee => employee.id === employeeId)?.fullName ?? employeeId;
  }

  conceptName(conceptId: string): string {
    return this.concepts.find(concept => concept.id === conceptId)?.name ?? conceptId;
  }

  amountLabel(bonus: PayrollBonusResponse): string {
    return bonus.amountType === 2
      ? `${bonus.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}%`
      : bonus.value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
  }

  statusLabel(status: number): string {
    return this.statusOptions.find(option => option.value === status)?.label ?? 'Estado';
  }

  statusBadgeClass(status: number): string {
    if (status === 2) return 'badge badge--in';
    if (status === 3) return 'badge badge--out';
    return 'badge badge--pending';
  }

  trackById(_index: number, bonus: PayrollBonusResponse): string {
    return bonus.id;
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

  private loadConcepts(): void {
    this.conceptsService.list(false).subscribe({
      next: concepts => {
        this.concepts = concepts;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar los conceptos de bonificación');
        this.cdr.markForCheck();
      }
    });
  }

  private loadBonuses(): void {
    const raw = this.filterForm.getRawValue();
    const employeeId = raw.employeeId || undefined;
    const status = raw.status ? Number(raw.status) : undefined;
    this.loading = true;
    this.bonusesService.list(employeeId, status).subscribe({
      next: bonuses => {
        this.bonuses = bonuses;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.toast.error(this.errorMessage(error, 'No se pudieron cargar las bonificaciones'));
        this.cdr.markForCheck();
      }
    });
  }

  private replaceBonus(updated: PayrollBonusResponse): void {
    this.bonuses = this.bonuses.map(bonus => bonus.id === updated.id ? updated : bonus);
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { detail?: string; message?: string; title?: string } } | null;
    return response?.error?.detail || response?.error?.message || response?.error?.title || fallback;
  }
}
