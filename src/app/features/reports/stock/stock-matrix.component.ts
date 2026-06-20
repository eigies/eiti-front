import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { StockMatrixResponse, StockMatrixRow } from '../../../core/models/report.models';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-stock-matrix-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-matrix.component.html',
  styleUrls: ['../reports.shared.css', './stock-matrix.component.css']
})
export class StockMatrixComponent implements OnInit {
  loading = false;
  data: StockMatrixResponse | null = null;
  search = '';
  hideEmpty = false;

  constructor(
    private readonly reportService: ReportService,
    private readonly toast: ToastService,
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.reportService.stockMatrix().subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  get filteredRows(): StockMatrixRow[] {
    if (!this.data) return [];
    const q = this.search.trim().toLowerCase();
    return this.data.rows.filter(r => {
      if (this.hideEmpty && r.total === 0) return false;
      if (!q) return true;
      return r.code.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q)
        || r.brand.toLowerCase().includes(q);
    });
  }

  branchTotal(index: number): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.available[index] ?? 0), 0);
  }

  get productCount(): number {
    return this.data?.rows.length ?? 0;
  }

  get branchCount(): number {
    return this.data?.branches.length ?? 0;
  }

  get emptyProductCount(): number {
    return this.data?.rows.filter(row => row.total === 0).length ?? 0;
  }

  get activeProductCount(): number {
    return this.data?.rows.filter(row => row.total > 0).length ?? 0;
  }

  get grandTotal(): number {
    return this.filteredRows.reduce((sum, r) => sum + r.total, 0);
  }

  get datasetGrandTotal(): number {
    return this.data?.rows.reduce((sum, r) => sum + r.total, 0) ?? 0;
  }

  get maxCellQuantity(): number {
    if (!this.data) return 0;
    return this.data.rows.reduce((max, row) => {
      const rowMax = row.available.reduce((innerMax, quantity) => Math.max(innerMax, quantity ?? 0), 0);
      return Math.max(max, rowMax);
    }, 0);
  }

  get hasActiveFilters(): boolean {
    return this.search.trim().length > 0 || this.hideEmpty;
  }

  stockCellClass(quantity: number | null | undefined): string {
    const value = quantity ?? 0;
    if (value <= 0) return 'sm-stock sm-stock--zero';
    if (value <= 2) return 'sm-stock sm-stock--low';
    if (this.maxCellQuantity > 0 && value >= Math.max(10, this.maxCellQuantity * .55)) return 'sm-stock sm-stock--high';
    return 'sm-stock sm-stock--ok';
  }

  exportExcel(): void {
    const rows = this.filteredRows;
    if (!this.data || rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const branches = this.data.branches;
    const sheet = rows.map(r => {
      const obj: Record<string, string | number> = {
        'Codigo': r.code,
        'Marca': r.brand,
        'Producto': r.name
      };
      branches.forEach((b, i) => { obj[b.name] = r.available[i] ?? 0; });
      obj['Total'] = r.total;
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock por sucursal');
    XLSX.writeFile(wb, `stock_por_sucursal_${new Date().toLocaleDateString('en-CA')}.xlsx`, { compression: true });
  }

  async exportPdf(): Promise<void> {
    const rows = this.filteredRows;
    if (!this.data || rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const branches = this.data.branches;

    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const branding = await this.pdfBranding.prepare();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usable = pageWidth - margin * 2;
    let y = 12;
    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title: 'Stock por sucursal',
        subtitle: `${rows.length} producto(s) - ${branches.length} sucursal(es) - Disponible`,
        continuation,
        margin,
        y: 12,
        pageWidth
      });
    };
    drawDocumentHeader();


    const prodW = Math.min(90, usable * 0.34);
    const totalW = 20;
    const branchW = (usable - prodW - totalW) / Math.max(1, branches.length);

    const columns: PdfTableColumn[] = [
      { header: 'Producto', width: prodW },
      ...branches.map(branch => ({ header: branch.name, width: branchW, align: 'right' as const })),
      { header: 'Total', width: totalW, align: 'right' }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);

    const drawHead = (): void => {
      y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth: usable, fontSize: 7.2 });
    };
    drawHead();

    rows.forEach((r, idx) => {
      y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
        drawDocumentHeader(true);
        drawHead();
        return y;
      });
      const values = [
        `${r.code} ${r.brand} ${r.name}`.trim(),
        ...branches.map((_, i) => String(r.available[i] ?? 0)),
        String(r.total)
      ];
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, values, y, {
        tableWidth: usable,
        alternate: idx % 2 === 0,
        fontSize: 7.2
      });
    });

    y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
      drawDocumentHeader(true);
      drawHead();
      return y;
    });
    y = this.pdfLayout.drawTableRow(doc, resolvedColumns, [
      'TOTAL',
      ...branches.map((_, i) => String(this.branchTotal(i))),
      String(this.grandTotal)
    ], y, { tableWidth: usable, total: true, fontSize: 7.2 });

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Reporte de stock');
    doc.save(`stock_por_sucursal_${new Date().toLocaleDateString('en-CA')}.pdf`);
  }
}
