import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { jsPDF } from 'jspdf';
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
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';
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
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService,
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

  exportReceiptPdf(liquidation: PayrollLiquidationResponse): void {
    void this.exportReceiptPdfAsync(liquidation);
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

  private async exportReceiptPdfAsync(liquidation: PayrollLiquidationResponse): Promise<void> {
    try {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const branding = await this.pdfBranding.prepare();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const tableWidth = pageWidth - margin * 2;
      let y = 16;

      const drawHeader = (continuation = false): void => {
        this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
        y = this.pdfBranding.drawHeader(doc, branding, {
          title: 'Recibo de sueldo',
          subtitle: `${this.employeeName(liquidation.employeeId)} / Periodo ${liquidation.periodLabel}`,
          continuation,
          margin,
          y: 12,
          pageWidth
        });
      };

      const drawInfo = (): void => {
        doc.setFillColor(244, 239, 229);
        doc.setDrawColor(221, 206, 180);
        doc.roundedRect(margin, y, tableWidth, 24, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120, 88, 33);
        doc.text('Empleado', margin + 4, y + 6);
        doc.text('Periodo', margin + 70, y + 6);
        doc.text('Fecha de pago', margin + 112, y + 6);
        doc.text('Medio de pago', margin + 150, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(35, 35, 35);
        doc.text(this.employeeName(liquidation.employeeId), margin + 4, y + 13, { maxWidth: 60 });
        doc.text(liquidation.periodLabel, margin + 70, y + 13);
        doc.text(liquidation.paidAt ? new Date(liquidation.paidAt).toLocaleString('es-AR') : '-', margin + 112, y + 13);
        doc.text(this.paymentMethodLabel(liquidation.paymentMethod), margin + 150, y + 13);
        y += 31;
      };

      const drawTable = (title: string, rows: Array<{ label: string; amount: number }>): void => {
        const columns = this.pdfLayout.resolveColumns(margin, [
          { header: title, width: tableWidth - 42 },
          { header: 'Importe', width: 42, align: 'right' }
        ] satisfies PdfTableColumn[]);
        const requiredHeight = 9 + Math.max(1, rows.length) * 7 + 8;
        y = this.pdfLayout.ensurePageSpace(doc, y, requiredHeight, pageHeight, () => {
          drawHeader(true);
          return y;
        });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(35, 35, 35);
        doc.text(title, margin, y);
        y += 4;
        y = this.pdfLayout.drawTableHeader(doc, columns, y, { tableWidth });
        const data = rows.length > 0 ? rows : [{ label: 'Sin movimientos', amount: 0 }];
        data.forEach((line, index) => {
          y = this.pdfLayout.drawTableRow(
            doc,
            columns,
            [line.label, this.money(line.amount)],
            y,
            { tableWidth, alternate: index % 2 === 0 }
          );
        });
        y = this.pdfLayout.drawTableRow(
          doc,
          columns,
          ['Total', this.money(this.lineTotal(rows))],
          y,
          { tableWidth, total: true }
        ) + 6;
      };

      drawHeader();
      drawInfo();
      drawTable('Descuentos', liquidation.deductionLines);
      drawTable('Adelantos', liquidation.advanceLines);

      y = this.pdfLayout.ensurePageSpace(doc, y, 24, pageHeight, () => {
        drawHeader(true);
        return y;
      });
      const totalColumns = this.pdfLayout.resolveColumns(margin, [
        { header: 'Concepto', width: tableWidth - 42 },
        { header: 'Importe', width: 42, align: 'right' }
      ] satisfies PdfTableColumn[]);
      y = this.pdfLayout.drawTableHeader(doc, totalColumns, y, { tableWidth });
      y = this.pdfLayout.drawTableRow(doc, totalColumns, ['Bruto', this.money(liquidation.grossAmount)], y, { tableWidth });
      this.pdfLayout.drawTableRow(doc, totalColumns, ['Neto a pagar', this.money(liquidation.netAmount)], y, { tableWidth, total: true });

      this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, `Recibo de sueldo / ${liquidation.periodLabel}`);
      doc.save(`recibo_sueldo_${this.fileSafe(this.employeeName(liquidation.employeeId))}_${this.fileSafe(liquidation.periodLabel)}.pdf`);
    } catch {
      this.toast.error('No se pudo generar el recibo PDF');
    }
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

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
  }

  private fileSafe(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
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
