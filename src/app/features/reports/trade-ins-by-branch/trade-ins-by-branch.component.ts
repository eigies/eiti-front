import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { CustomerService } from '../../../core/services/customer.service';
import { BranchService } from '../../../core/services/branch.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TradeInsByBranchResponse } from '../../../core/models/report.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-trade-ins-by-branch',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './trade-ins-by-branch.component.html',
  styleUrls: ['../reports.shared.css']
})
export class TradeInsByBranchComponent implements OnInit {
  filterForm: FormGroup;
  advancedFiltersOpen = false;

  loading = false;
  hasSearched = false;
  data: TradeInsByBranchResponse | null = null;

  customers: { id: string; label: string }[] = [];
  branches: { id: string; label: string }[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly customerService: CustomerService,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm = this.fb.group({
      dateFrom: [firstOfMonth, Validators.required],
      dateTo: [today, Validators.required],
      branchId: [null],
      customerId: [null]
    });
  }

  ngOnInit(): void {
    this.loadLookups();
    this.search();
  }

  get customerOptions(): SearchableSelectOption[] { return this.customers.map(c => ({ value: c.id, label: c.label })); }
  get branchOptions(): SearchableSelectOption[] { return this.branches.map(b => ({ value: b.id, label: b.label })); }

  get activeOptionalFiltersCount(): number {
    const v = this.filterForm.value;
    return [v.customerId, v.branchId].filter(Boolean).length;
  }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  toggleAdvancedFilters(): void {
    this.advancedFiltersOpen = !this.advancedFiltersOpen;
  }

  private loadLookups(): void {
    forkJoin({
      customers: this.customerService.listCustomers().pipe(catchError(() => of([]))),
      branches: this.branchService.listBranches().pipe(catchError(() => of([])))
    }).subscribe(({ customers, branches }) => {
      this.customers = customers.map(c => ({ id: c.id, label: c.fullName }));
      this.branches = branches.map(b => ({ id: b.id, label: b.name }));
    });
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
    this.reportService.tradeInsByBranch({
      dateFrom: v.dateFrom,
      dateTo: v.dateTo,
      branchId: v.branchId || null,
      customerId: v.customerId || null
    }).subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.toast.error(err?.error?.detail || 'No se pudo generar el reporte.');
      }
    });
  }

  clearFilters(): void {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm.reset({ dateFrom: firstOfMonth, dateTo: today, branchId: null, customerId: null });
    this.advancedFiltersOpen = false;
    this.search();
  }

  // Cantidad de sucursales distintas presentes en el resultado (para el encabezado de resultados).
  get branchCount(): number {
    if (!this.data) return 0;
    return new Set(this.data.rows.map(r => r.branchId)).size;
  }

  // Marca el primer renglón de cada sucursal para dibujar el separador visual en la tabla.
  isFirstRowOfBranch(index: number): boolean {
    if (!this.data || index === 0) return false;
    return this.data.rows[index].branchId !== this.data.rows[index - 1].branchId;
  }

  money(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const rows = this.data.rows.map(r => ({
      Sucursal: r.branchName,
      Producto: r.productName,
      Marca: r.productBrand,
      SKU: r.productSku,
      Operaciones: r.operations,
      Unidades: r.units,
      'Valor total': r.amount,
      'Valor unit. prom.': r.avgUnitValue
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Canjes por sucursal');
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
    const subtitle = `Reporteria / Ventas · Desde ${f.dateFrom} hasta ${f.dateTo}`;
    let y = 12;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title: 'Productos recibidos en canje por sucursal',
        subtitle,
        continuation,
        margin,
        y: 12,
        pageWidth
      });
    };

    drawDocumentHeader();

    const columns: PdfTableColumn[] = [
      { header: 'Sucursal', width: 45 },
      { header: 'Producto', width: 65 },
      { header: 'Marca', width: 32 },
      { header: 'SKU', width: 30 },
      { header: 'Oper.', width: 20 },
      { header: 'Unidades', width: 24 },
      { header: 'Valor total', width: 34 },
      { header: 'Valor unit. prom.', width: 34 }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);
    const drawHead = () => {
      y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth: pageWidth - margin * 2, fontSize: 7.6 });
    };
    drawHead();

    this.data.rows.forEach((r, idx) => {
      y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
        drawDocumentHeader(true);
        drawHead();
        return y;
      });
      const cells = [
        r.branchName,
        r.productName,
        r.productBrand,
        r.productSku,
        String(r.operations),
        String(r.units),
        this.money(r.amount),
        this.money(r.avgUnitValue)
      ];
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, cells, y, {
        tableWidth: pageWidth - margin * 2,
        alternate: idx % 2 === 0,
        fontSize: 7.5
      });
    });

    const t = this.data.totals;
    const totalCells = [
      'TOTAL',
      '',
      '',
      '',
      String(t.operations),
      String(t.units),
      this.money(t.amount),
      this.money(t.avgUnitValue)
    ];
    y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
      drawDocumentHeader(true);
      drawHead();
      return y;
    });
    y = this.pdfLayout.drawTableRow(doc, resolvedColumns, totalCells, y, {
      tableWidth: pageWidth - margin * 2,
      total: true,
      fontSize: 7.5
    });

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Productos recibidos en canje por sucursal');
    doc.save(this.fileName('pdf'));
  }

  private fileName(ext: string): string {
    const f = this.filterForm.value;
    return `canjes_por_sucursal_${f.dateFrom}_${f.dateTo}.${ext}`;
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
  trackByRow(_: number, r: { branchId: string; productId: string }): string { return `${r.branchId}|${r.productId}`; }
}
