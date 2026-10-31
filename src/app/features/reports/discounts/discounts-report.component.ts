import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { BranchService } from '../../../core/services/branch.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DiscountsReportResponse, DiscountsReportRow } from '../../../core/models/report.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-discounts-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './discounts-report.component.html',
  styleUrls: ['../reports.shared.css', './discounts-report.component.css']
})
export class DiscountsReportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reportService = inject(ReportService);
  private readonly branchService = inject(BranchService);
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly pdfBranding = inject(PdfBrandingService);
  private readonly pdfLayout = inject(PdfLayoutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filterForm: FormGroup;
  advancedFiltersOpen = false;

  loading = false;
  hasSearched = false;
  data: DiscountsReportResponse | null = null;

  branchOptions: SearchableSelectOption[] = [];
  /**
   * Quien aplico descuentos. La lista de usuarios pide users.manage: sin ese permiso las opciones salen
   * de los usuarios que aparecen en los resultados (y se acumulan entre busquedas).
   */
  private readonly knownUsers = new Map<string, string>();
  userOptions: SearchableSelectOption[] = [];

  constructor() {
    this.filterForm = this.fb.group({
      dateFrom: [this.firstOfMonth(), Validators.required],
      dateTo: [this.today(), Validators.required],
      branchId: [null],
      userId: [null]
    });
  }

  ngOnInit(): void {
    this.loadLookups();
    this.search();
  }

  get activeOptionalFiltersCount(): number {
    const v = this.filterForm.value;
    return [v.branchId, v.userId].filter(Boolean).length;
  }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  toggleAdvancedFilters(): void {
    this.advancedFiltersOpen = !this.advancedFiltersOpen;
  }

  search(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.toast.error('Las fechas desde y hasta son obligatorias.');
      return;
    }
    const v = this.filterForm.value;
    if (v.dateFrom > v.dateTo) {
      this.toast.error('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.loading = true;
    this.hasSearched = true;
    this.reportService.getDiscountsReport({
      dateFrom: v.dateFrom,
      dateTo: v.dateTo,
      branchId: v.branchId || null,
      userId: v.userId || null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.data = res;
        this.loading = false;
        res.rows.forEach(row => {
          if (row.appliedByUserId && row.appliedByUserName) {
            this.knownUsers.set(row.appliedByUserId, row.appliedByUserName);
          }
        });
        this.refreshUserOptions();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.toast.error(err?.error?.detail || 'No se pudo generar el reporte.');
      }
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ dateFrom: this.firstOfMonth(), dateTo: this.today(), branchId: null, userId: null });
    this.advancedFiltersOpen = false;
    this.search();
  }

  saleTypeLabel(row: DiscountsReportRow): string {
    return row.isCuentaCorriente ? 'Cuenta corriente' : 'Minorista';
  }

  appliedBy(row: DiscountsReportRow): string {
    return row.appliedByUserName || 'Sin dato';
  }

  money(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  percent(value: number): string {
    return `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
  }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const rows = this.data.rows.map(r => ({
      Fecha: this.dateLabel(r.date),
      Venta: r.saleCode,
      Sucursal: r.branchName,
      Cliente: r.customerName,
      Tipo: this.saleTypeLabel(r),
      'Aplicado por': this.appliedBy(r),
      'Descuento %': r.discountPercent,
      'Subtotal sin descuento': r.subtotalBeforeDiscount,
      'Monto descontado': r.discountAmount,
      Total: r.total,
      Motivo: r.reason ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Descuentos');
    XLSX.writeFile(wb, this.fileName('xlsx'), { compression: true });
  }

  async exportPdf(): Promise<void> {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const branding = await this.pdfBranding.prepare();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const f = this.filterForm.value;
    const title = 'Descuentos en ventas';
    const subtitle = `Reporteria / Ventas · Desde ${f.dateFrom} hasta ${f.dateTo}`;
    let y = 12;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, { title, subtitle, continuation, margin, y: 12, pageWidth });
    };

    drawDocumentHeader();

    const columns: PdfTableColumn[] = [
      { header: 'Fecha', width: 24 },
      { header: 'Venta', width: 22 },
      { header: 'Sucursal', width: 28 },
      { header: 'Cliente', width: 34 },
      { header: 'Tipo', width: 20 },
      { header: 'Aplicado por', width: 28 },
      { header: '%', width: 12 },
      { header: 'Subtotal', width: 24 },
      { header: 'Descontado', width: 24 },
      { header: 'Total', width: 24 },
      { header: 'Motivo', width: 37 }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);
    const tableWidth = pageWidth - margin * 2;
    const drawHead = () => {
      y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth, fontSize: 7.4 });
    };
    const ensureSpace = () => {
      y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
        drawDocumentHeader(true);
        drawHead();
        return y;
      });
    };
    drawHead();

    this.data.rows.forEach((r, idx) => {
      ensureSpace();
      const cells = [
        this.dateLabel(r.date),
        r.saleCode,
        r.branchName,
        r.customerName,
        this.saleTypeLabel(r),
        this.appliedBy(r),
        this.percent(r.discountPercent),
        this.money(r.subtotalBeforeDiscount),
        this.money(r.discountAmount),
        this.money(r.total),
        r.reason ?? ''
      ];
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, cells, y, { tableWidth, alternate: idx % 2 === 0, fontSize: 7.3 });
    });

    const t = this.data.totals;
    ensureSpace();
    y = this.pdfLayout.drawTableRow(doc, resolvedColumns,
      ['TOTAL', `${t.salesCount} ventas`, '', '', '', '', '', '', this.money(t.discountAmount), '', ''],
      y, { tableWidth, total: true, fontSize: 7.3 });

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, title);
    doc.save(this.fileName('pdf'));
  }

  trackByRow(_: number, r: DiscountsReportRow): string { return r.saleId; }

  private loadLookups(): void {
    this.branchService.listBranches().pipe(
      catchError(() => of([])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(branches => {
      this.branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
    });

    if (!this.auth.hasPermission(PermissionCodes.usersManage)) {
      return;
    }
    this.userService.listUsers().pipe(
      catchError(() => of([])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(users => {
      users.forEach(user => {
        if (!this.knownUsers.has(user.id)) {
          this.knownUsers.set(user.id, user.fullName?.trim() || user.username);
        }
      });
      this.refreshUserOptions();
    });
  }

  private refreshUserOptions(): void {
    this.userOptions = [...this.knownUsers.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  private dateLabel(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private fileName(ext: string): string {
    const f = this.filterForm.value;
    return `descuentos_${f.dateFrom}_${f.dateTo}.${ext}`;
  }

  // "Hoy" del usuario, no el de UTC (lección 2026-08-15).
  private today(): string { return new Date().toLocaleDateString('en-CA'); }

  private firstOfMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  }
}
