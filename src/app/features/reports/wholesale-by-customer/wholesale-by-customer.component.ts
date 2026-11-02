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
import { WholesaleByCustomerResponse, WholesaleByCustomerRow } from '../../../core/models/report.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-wholesale-by-customer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './wholesale-by-customer.component.html',
  styleUrls: ['../reports.shared.css']
})
export class WholesaleByCustomerComponent implements OnInit {
  filterForm: FormGroup;
  advancedFiltersOpen = false;

  loading = false;
  hasSearched = false;
  data: WholesaleByCustomerResponse | null = null;

  customers: { id: string; label: string }[] = [];
  branches: { id: string; label: string }[] = [];

  readonly saleTypes = [
    { value: 'wholesale', label: 'Mayorista (CC)' },
    { value: 'retail', label: 'Minorista' },
    { value: 'all', label: 'Todas' }
  ];

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
      saleType: ['wholesale'],
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
  get saleTypeOptions(): SearchableSelectOption[] { return this.saleTypes.map(t => ({ value: t.value, label: t.label })); }

  /** El tipo de venta esta a la vista junto a las fechas: solo cliente y sucursal cuentan como filtros adicionales. */
  get activeOptionalFiltersCount(): number {
    const v = this.filterForm.value;
    return [v.customerId, v.branchId].filter(Boolean).length;
  }

  /** El saldo de cuenta corriente no dice nada de una venta minorista: solo se muestra en Mayorista y Todas. */
  get showCcPending(): boolean {
    return (this.data?.saleType ?? 'wholesale') !== 'retail';
  }

  /** Las ventas sin cliente cargado van juntas en "(Consumidor final)", al final y atenuadas. */
  isWalkIn(row: WholesaleByCustomerRow): boolean {
    return row.customerId === null;
  }

  lastSaleLabel(row: WholesaleByCustomerRow): string {
    return new Date(row.lastSaleAt).toLocaleDateString('es-AR', { dateStyle: 'short' });
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
    this.reportService.wholesaleByCustomer({
      dateFrom: v.dateFrom,
      dateTo: v.dateTo,
      saleType: v.saleType || 'wholesale',
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
    this.filterForm.reset({ dateFrom: firstOfMonth, dateTo: today, saleType: 'wholesale', branchId: null, customerId: null });
    this.advancedFiltersOpen = false;
    this.search();
  }

  /** El tipo de los resultados en pantalla (no el del formulario, que puede haber cambiado sin aplicar). */
  get saleTypeLabel(): string {
    const value = this.data?.saleType || this.filterForm.value.saleType || 'wholesale';
    return this.saleTypes.find(t => t.value === value)?.label ?? 'Mayorista (CC)';
  }

  money(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const showCc = this.showCcPending;
    const rows = this.data.rows.map(r => ({
      Cliente: r.customerName,
      'Ultima compra': this.lastSaleLabel(r),
      Operaciones: r.operations,
      Unidades: r.units,
      Facturacion: r.revenue,
      'Ticket promedio': r.avgTicket,
      ...(showCc ? { 'Saldo CC pendiente': r.ccPending } : {}),
      Costo: r.cost,
      Ganancia: r.profit,
      'Margen %': r.marginPct
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas por cliente');
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
    const subtitle = `Reporteria / Ventas · ${this.saleTypeLabel} · Desde ${f.dateFrom} hasta ${f.dateTo}`;
    let y = 12;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title: 'Ventas por cliente',
        subtitle,
        continuation,
        margin,
        y: 12,
        pageWidth
      });
    };

    drawDocumentHeader();

    const showCc = this.showCcPending;
    const columns: PdfTableColumn[] = [
      { header: 'Cliente', width: 56 },
      { header: 'Ult. compra', width: 22 },
      { header: 'Oper.', width: 16 },
      { header: 'Unid.', width: 16 },
      { header: 'Facturacion', width: 30 },
      { header: 'Ticket prom.', width: 26 },
      ...(showCc ? [{ header: 'Saldo CC', width: 26 }] : []),
      { header: 'Costo', width: 26 },
      { header: 'Ganancia', width: 28 },
      { header: 'Margen %', width: 20 }
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
        r.customerName,
        this.lastSaleLabel(r),
        String(r.operations),
        String(r.units),
        this.money(r.revenue),
        this.money(r.avgTicket),
        ...(showCc ? [this.money(r.ccPending)] : []),
        this.money(r.cost),
        this.money(r.profit),
        `${r.marginPct}%`
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
      String(t.operations),
      String(t.units),
      this.money(t.revenue),
      this.money(t.avgTicket),
      ...(showCc ? [this.money(t.ccPending)] : []),
      this.money(t.cost),
      this.money(t.profit),
      `${t.marginPct}%`
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

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Ventas por cliente');
    doc.save(this.fileName('pdf'));
  }

  private fileName(ext: string): string {
    const f = this.filterForm.value;
    return `ventas_por_cliente_${f.dateFrom}_${f.dateTo}.${ext}`;
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
  trackByRow(_: number, r: { customerId: string | null }): string { return r.customerId ?? '__final__'; }
}
