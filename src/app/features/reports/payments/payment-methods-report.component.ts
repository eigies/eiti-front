import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { BranchService } from '../../../core/services/branch.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { ToastService } from '../../../shared/services/toast.service';
import { PaymentMethodsReportResponse } from '../../../core/models/report.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-payment-methods-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './payment-methods-report.component.html',
  styleUrls: ['../reports.shared.css', './payment-methods-report.component.css']
})
export class PaymentMethodsReportComponent implements OnInit {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  data: PaymentMethodsReportResponse | null = null;
  branches: BranchResponse[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
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
      saleType: ['all']
    });
  }

  readonly saleTypes = [
    { value: 'all', label: 'Todas' },
    { value: 'wholesale', label: 'Mayorista (CC)' },
    { value: 'retail', label: 'Minorista' }
  ];

  get branchOptions(): SearchableSelectOption[] { return this.branches.map(b => ({ value: b.id, label: b.name })); }
  get saleTypeOptions(): SearchableSelectOption[] { return this.saleTypes.map(t => ({ value: t.value, label: t.label })); }

  ngOnInit(): void {
    this.branchService.listBranches().subscribe({
      next: branches => this.branches = branches,
      error: () => this.branches = []
    });
    this.search();
  }

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
    this.reportService.paymentMethods(v.dateFrom, v.dateTo, v.branchId || undefined, v.saleType).subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay pagos para exportar.'); return; }
    const rows: Record<string, unknown>[] = [];
    for (const r of this.data.rows) {
      rows.push({ 'Medio de pago': r.methodLabel, 'Cantidad': r.count, 'Monto': r.total, '% del total': r.percent });
      for (const s of r.subgroups) {
        rows.push({ 'Medio de pago': `   ${s.label}`, 'Cantidad': s.count, 'Monto': s.total, '% del total': s.percent });
      }
    }
    rows.push({ 'Medio de pago': 'TOTAL', 'Cantidad': this.data.totals.count, 'Monto': this.data.totals.total, '% del total': 100 });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medios de pago');
    const f = this.filterForm.value;
    XLSX.writeFile(wb, `medios_de_pago_${f.dateFrom}_${f.dateTo}.xlsx`, { compression: true });
  }

  async exportPdf(): Promise<void> {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
    const branding = await this.pdfBranding.prepare();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const f = this.filterForm.value;
    const branchName = f.branchId ? (this.branches.find(b => b.id === f.branchId)?.name ?? '') : 'Todas las sucursales';
    const saleTypeName = this.saleTypes.find(t => t.value === (f.saleType || 'all'))?.label ?? 'Todas';
    const subtitle = `Medios de pago · Desde ${f.dateFrom} hasta ${f.dateTo} · ${branchName} · ${saleTypeName}`;
    let y = 12;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title: 'Cobros por medio de pago',
        subtitle,
        continuation,
        margin,
        y: 12,
        pageWidth
      });
    };

    drawDocumentHeader();

    const columns: PdfTableColumn[] = [
      { header: 'Medio de pago', width: 70 },
      { header: 'Cantidad', width: 35 },
      { header: 'Monto', width: 50 },
      { header: '% del total', width: 35 }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);

    const drawHead = () => {
      y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth: pageWidth - margin * 2, fontSize: 8 });
    };
    drawHead();

    let rowIdx = 0;
    this.data.rows.forEach(r => {
      y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
        drawDocumentHeader(true);
        drawHead();
        return y;
      });
      const cells = [r.methodLabel, String(r.count), `$ ${this.money(r.total)}`, `${r.percent}%`];
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, cells, y, {
        tableWidth: pageWidth - margin * 2,
        alternate: rowIdx % 2 === 0,
        fontSize: 8
      });
      rowIdx++;

      r.subgroups.forEach(s => {
        y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
          drawDocumentHeader(true);
          drawHead();
          return y;
        });
        const subCells = [`   ${s.label}`, String(s.count), `$ ${this.money(s.total)}`, `${s.percent}%`];
        y = this.pdfLayout.drawTableRow(doc, resolvedColumns, subCells, y, {
          tableWidth: pageWidth - margin * 2,
          alternate: rowIdx % 2 === 0,
          fontSize: 7.2
        });
        rowIdx++;
      });
    });

    const t = this.data.totals;
    const totalCells = ['TOTAL', String(t.count), `$ ${this.money(t.total)}`, '100%'];
    y = this.pdfLayout.ensurePageSpace(doc, y, 6, pageHeight, () => {
      drawDocumentHeader(true);
      drawHead();
      return y;
    });
    y = this.pdfLayout.drawTableRow(doc, resolvedColumns, totalCells, y, {
      tableWidth: pageWidth - margin * 2,
      total: true,
      fontSize: 8
    });

    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Reporte de medios de pago');
    doc.save(`medios_de_pago_${f.dateFrom}_${f.dateTo}.pdf`);
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
}
