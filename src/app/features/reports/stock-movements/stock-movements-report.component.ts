import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { ProductService } from '../../../core/services/product.service';
import { BranchService } from '../../../core/services/branch.service';
import { StockService } from '../../../core/services/stock.service';
import { ToastService } from '../../../shared/services/toast.service';
import { StockMovementsReportResponse, StockMovementsReportRow } from '../../../core/models/report.models';
import { TransferDetailResponse } from '../../../core/models/stock.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-stock-movements-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './stock-movements-report.component.html',
  styleUrls: ['../reports.shared.css', './stock-movements-report.component.css']
})
export class StockMovementsReportComponent implements OnInit, OnDestroy {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  data: StockMovementsReportResponse | null = null;

  products: { id: string; label: string }[] = [];
  branches: { id: string; name: string }[] = [];

  readonly movementTypes = [
    { value: 1, label: 'Entrada manual' },
    { value: 2, label: 'Ajuste manual' },
    { value: 3, label: 'Reserva' },
    { value: 4, label: 'Liberación de reserva' },
    { value: 5, label: 'Venta' },
    { value: 6, label: 'Canje (ingreso)' },
    { value: 7, label: 'Devolución de venta' },
    { value: 8, label: 'Compra' },
    { value: 9, label: 'Devolución de compra' },
    { value: 10, label: 'Transferencia (salida)' },
    { value: 11, label: 'Transferencia (entrada)' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly stockService: StockService,
    private readonly toast: ToastService,
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm = this.fb.group({
      dateFrom: [firstOfMonth, Validators.required],
      dateTo: [today, Validators.required],
      productId: [null],
      branchId: [null],
      type: [null]
    });
  }

  ngOnInit(): void {
    this.productService.listProducts().subscribe({
      next: products => this.products = products.map(p => ({ id: p.id, label: `${p.code} · ${p.brand} ${p.name}`.trim() })),
      error: () => this.products = []
    });
    this.branchService.listBranches().subscribe({
      next: branches => this.branches = branches.map(b => ({ id: b.id, name: b.name })),
      error: () => this.branches = []
    });
    this.search();
  }

  get productOptions(): SearchableSelectOption[] { return this.products.map(p => ({ value: p.id, label: p.label })); }
  get branchOptions(): SearchableSelectOption[] { return this.branches.map(b => ({ value: b.id, label: b.name })); }
  get typeOptions(): SearchableSelectOption[] { return this.movementTypes.map(t => ({ value: t.value, label: t.label })); }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  search(): void {
    if (this.filterForm.invalid) { this.filterForm.markAllAsTouched(); this.toast.error('Las fechas son obligatorias.'); return; }
    const v = this.filterForm.value;
    if (v.dateFrom > v.dateTo) { this.toast.error('La fecha desde no puede ser posterior a la hasta.'); return; }

    this.loading = true;
    this.hasSearched = true;
    this.reportService.stockMovements(v.dateFrom, v.dateTo, v.productId || undefined, v.branchId || undefined, v.type ?? undefined).subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  // Detalle de traspaso (popup).
  transferPopup: TransferDetailResponse | null = null;
  transferLoading = false;
  private transferRequest: Subscription | null = null;

  get transferTotalQuantity(): number {
    return this.transferPopup?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  }

  isTransfer(r: StockMovementsReportRow): boolean {
    return r.referenceType === 'Transfer' && !!r.referenceId;
  }

  openTransfer(r: StockMovementsReportRow): void {
    if (!this.isTransfer(r) || !r.referenceId) return;
    this.transferRequest?.unsubscribe();
    this.transferPopup = null;
    this.transferLoading = true;
    this.transferRequest = this.stockService.getTransferDetail(r.referenceId).subscribe({
      next: detail => {
        this.transferPopup = detail;
        this.transferLoading = false;
        this.transferRequest = null;
      },
      error: () => {
        this.transferLoading = false;
        this.transferRequest = null;
        this.toast.error('No se pudo cargar el detalle del traspaso.');
      }
    });
  }

  closeTransfer(): void {
    this.transferRequest?.unsubscribe();
    this.transferRequest = null;
    this.transferPopup = null;
    this.transferLoading = false;
  }

  @HostListener('document:keydown.escape')
  closeTransferWithEscape(): void {
    if (this.transferPopup || this.transferLoading) this.closeTransfer();
  }

  ngOnDestroy(): void {
    this.transferRequest?.unsubscribe();
  }

  qty(n: number): string { return n.toLocaleString('es-AR'); }
  formatDate(value: string): string { return new Date(value).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }

  signed(r: { direction: number; quantity: number }): string {
    if (r.direction > 0) return `+${this.qty(r.quantity)}`;
    if (r.direction < 0) return `-${this.qty(r.quantity)}`;
    return this.qty(r.quantity);
  }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay movimientos para exportar.'); return; }
    const rows: Record<string, unknown>[] = this.data.rows.map(r => ({
      'Fecha': this.formatDate(r.date),
      'Sucursal': r.branchName,
      'Producto': `${r.code} ${r.brand} ${r.name}`.trim(),
      'Tipo': r.typeName,
      'Cantidad': r.direction * r.quantity,
      'Documento': r.referenceCode ?? '',
      'Detalle': r.description ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const f = this.filterForm.value;
    XLSX.writeFile(wb, `movimientos_stock_${f.dateFrom}_${f.dateTo}.xlsx`, { compression: true });
  }

  async exportPdf(): Promise<void> {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay movimientos para exportar.'); return; }
    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const branding = await this.pdfBranding.prepare();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const f = this.filterForm.value;
    const subtitle = `Movimientos de stock · Desde ${f.dateFrom} hasta ${f.dateTo}`;
    let y = 12;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, { title: 'Movimientos de stock', subtitle, continuation, margin, y: 12, pageWidth });
    };
    drawDocumentHeader();

    const columns: PdfTableColumn[] = [
      { header: 'Fecha', width: 34 },
      { header: 'Sucursal', width: 38 },
      { header: 'Producto', width: 90 },
      { header: 'Tipo', width: 45 },
      { header: 'Cant.', width: 24 },
      { header: 'Documento', width: 35 }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);
    const drawHead = () => { y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth: pageWidth - margin * 2, fontSize: 7.6 }); };
    drawHead();

    this.data.rows.forEach((r, idx) => {
      y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => { drawDocumentHeader(true); drawHead(); return y; });
      const cells = [this.formatDate(r.date), r.branchName, `${r.code} ${r.brand} ${r.name}`.trim(), r.typeName, this.signed(r), r.referenceCode ?? ''];
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, cells, y, { tableWidth: pageWidth - margin * 2, alternate: idx % 2 === 0, fontSize: 7.4 });
    });

    const t = this.data.totals;
    y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => { drawDocumentHeader(true); drawHead(); return y; });
    y = this.pdfLayout.drawTableRow(doc, resolvedColumns, ['TOTALES', '', '', `Entradas +${this.qty(t.entradas)} / Salidas -${this.qty(t.salidas)}`, `${t.neto >= 0 ? '+' : ''}${this.qty(t.neto)}`, ''], y, { tableWidth: pageWidth - margin * 2, total: true, fontSize: 7.4 });

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Reporte de movimientos de stock');
    doc.save(`movimientos_stock_${f.dateFrom}_${f.dateTo}.pdf`);
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
}
