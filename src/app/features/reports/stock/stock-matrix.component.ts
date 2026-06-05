import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { StockMatrixResponse, StockMatrixRow } from '../../../core/models/report.models';

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

  constructor(private readonly reportService: ReportService, private readonly toast: ToastService) {}

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

  exportPdf(): void {
    const rows = this.filteredRows;
    if (!this.data || rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const branches = this.data.branches;

    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usable = pageWidth - margin * 2;
    let y = 16;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(28, 28, 28);
    doc.text('Stock por sucursal', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(108, 108, 108);
    doc.text(`Emitido: ${new Date().toLocaleString('es-AR')}`, pageWidth - margin, y - .2, { align: 'right' });
    y += 5;
    doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    doc.text(`${rows.length} producto(s) · ${branches.length} sucursal(es) · Disponible`, margin, y);
    y += 7;

    const prodW = Math.min(90, usable * 0.34);
    const totalW = 20;
    const branchW = (usable - prodW - totalW) / Math.max(1, branches.length);

    const headers = ['Producto', ...branches.map(b => b.name), 'Total'];
    const colW = [prodW, ...branches.map(() => branchW), totalW];
    const xs: number[] = []; let cx = margin;
    colW.forEach(w => { xs.push(cx); cx += w; });

    const drawCell = (text: string, i: number, yy: number, alignRight: boolean): void => {
      if (alignRight) doc.text(text, xs[i] + colW[i] - 1.5, yy, { align: 'right' });
      else doc.text(doc.splitTextToSize(text, colW[i] - 2)[0] ?? '', xs[i] + 1.5, yy);
    };

    const drawHead = (): void => {
      doc.setFillColor(235, 232, 225); doc.setDrawColor(206, 202, 192);
      doc.roundedRect(margin, y, usable, 7, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(62, 62, 62);
      headers.forEach((h, i) => drawCell(h, i, y + 4.7, i > 0));
      y += 7;
    };
    drawHead();

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(35, 35, 35);
    rows.forEach((r, idx) => {
      if (y > pageHeight - 16) { doc.addPage(); y = 16; drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(35, 35, 35); }
      if (idx % 2 === 0) { doc.setFillColor(249, 248, 245); doc.rect(margin, y, usable, 6, 'F'); }
      drawCell(`${r.code} ${r.brand} ${r.name}`.trim(), 0, y + 4, false);
      branches.forEach((_, i) => drawCell(String(r.available[i] ?? 0), i + 1, y + 4, true));
      drawCell(String(r.total), headers.length - 1, y + 4, true);
      y += 6;
    });

    if (y > pageHeight - 16) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold'); doc.setFillColor(244, 239, 229); doc.rect(margin, y, usable, 6, 'F');
    doc.setTextColor(35, 35, 35);
    drawCell('TOTAL', 0, y + 4, false);
    branches.forEach((_, i) => drawCell(String(this.branchTotal(i)), i + 1, y + 4, true));
    drawCell(String(this.grandTotal), headers.length - 1, y + 4, true);

    doc.save(`stock_por_sucursal_${new Date().toLocaleDateString('en-CA')}.pdf`);
  }
}
