import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  DailySalesControlResponse,
  DailySalesControlRow,
  DailySalesPaymentItem,
  DailySalesProductItem,
  DailySalesTradeInItem
} from '../../../core/models/report.models';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../shared/services/pdf-layout.service';

@Component({
  selector: 'app-daily-sales-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './daily-sales-control.component.html',
  styleUrls: ['../reports.shared.css', './daily-sales-control.component.css']
})
export class DailySalesControlComponent implements OnInit {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  data: DailySalesControlResponse | null = null;

  readonly statusOptions = [
    { value: 0, label: 'Activas' },
    { value: 2, label: 'Pagadas' },
    { value: 1, label: 'Pendientes' },
    { value: 3, label: 'Canceladas' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly toast: ToastService,
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {
    const today = this.toIso(new Date());
    this.filterForm = this.fb.group({
      dateFrom: [today, Validators.required],
      dateTo: [today, Validators.required],
      status: [0],
      search: ['']
    });
  }

  ngOnInit(): void {
    this.search();
  }

  get filteredRows(): DailySalesControlRow[] {
    const rows = this.data?.rows ?? [];
    const query = String(this.filterForm.value.search ?? '').trim().toLowerCase();
    if (!query) return rows;

    return rows.filter(row => [
      row.code,
      row.branchName,
      row.customerName,
      ...row.products.flatMap(product => [product.code, product.brand, product.name]),
      ...row.payments.flatMap(payment => [payment.method, payment.reference]),
      ...row.tradeIns.flatMap(tradeIn => [tradeIn.code, tradeIn.brand, tradeIn.name])
    ].some(value => String(value ?? '').toLowerCase().includes(query)));
  }

  search(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.toast.error('Las fechas son obligatorias.');
      return;
    }

    const value = this.filterForm.value;
    if (value.dateFrom > value.dateTo) {
      this.toast.error('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.loading = true;
    this.hasSearched = true;
    this.reportService.dailySalesControl(value.dateFrom, value.dateTo, Number(value.status ?? 0)).subscribe({
      next: response => {
        this.data = response;
        this.loading = false;
      },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.toast.error(err?.error?.detail || 'No se pudo cargar el control de ventas.');
      }
    });
  }

  clearFilters(): void {
    const today = this.toIso(new Date());
    this.filterForm.reset({ dateFrom: today, dateTo: today, status: 0, search: '' });
    this.search();
  }

  statusLabel(row: DailySalesControlRow): string {
    if (row.statusCode === 2) return 'Pagada';
    if (row.statusCode === 3) return 'Cancelada';
    return row.isCuentaCorriente ? 'Cta. corriente' : 'Pendiente';
  }

  paymentMethodLabel(payment: DailySalesPaymentItem): string {
    switch (payment.methodCode) {
      case 1: return 'Efectivo';
      case 2: return 'Transferencia';
      case 3: return 'Tarjeta';
      case 4: return 'Cheque';
      case 6: return 'Crédito cliente';
      default: return 'Otro';
    }
  }

  productsText(products: DailySalesProductItem[]): string {
    return products
      .map(product => `${product.quantity}x ${product.code} · ${product.brand} ${product.name}`.trim())
      .join(' | ');
  }

  paymentsText(payments: DailySalesPaymentItem[]): string {
    if (payments.length === 0) return 'Sin pago registrado';
    return payments.map(payment => {
      const reference = payment.reference ? ` · Ref. ${payment.reference}` : '';
      return `${this.paymentMethodLabel(payment)}${reference}`;
    }).join(' | ');
  }

  tradeInsText(tradeIns: DailySalesTradeInItem[]): string {
    if (tradeIns.length === 0) return 'Sin canje';
    return tradeIns
      .map(item => `${item.quantity}x ${item.code} · ${item.brand} ${item.name} ($ ${this.money(item.amount)})`)
      .join(' | ');
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  money(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackBySaleId(_: number, row: DailySalesControlRow): string {
    return row.saleId;
  }

  exportExcel(): void {
    const rows = this.filteredRows;
    if (rows.length === 0) {
      this.toast.error('No hay ventas para exportar.');
      return;
    }

    const sheet = rows.map(row => ({
      'Fecha y hora': this.formatDateTime(row.createdAt),
      'Comprobante': row.code || row.saleId,
      'Sucursal': row.branchName,
      'Cliente': row.customerName,
      'Estado': this.statusLabel(row),
      'Batería vendida': this.productsText(row.products),
      'Pago / referencia': this.paymentsText(row.payments),
      'Canje': this.tradeInsText(row.tradeIns),
      'Total': row.totalAmount
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheet);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 18 },
      { wch: 52 }, { wch: 42 }, { wch: 52 }, { wch: 16 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Control de ventas');
    const value = this.filterForm.value;
    XLSX.writeFile(
      workbook,
      `control_ventas_${value.dateFrom}_${value.dateTo}.xlsx`,
      { compression: true }
    );
  }

  async exportPdf(): Promise<void> {
    const rows = this.filteredRows;
    if (rows.length === 0) {
      this.toast.error('No hay ventas para exportar.');
      return;
    }

    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const branding = await this.pdfBranding.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 9;
    const tableWidth = pageWidth - margin * 2;
    const columns: PdfTableColumn[] = [
      { header: 'Hora', width: 17 },
      { header: 'Comprobante', width: 25 },
      { header: 'Sucursal', width: 25 },
      { header: 'Cliente', width: 35 },
      { header: 'Batería vendida', width: 57 },
      { header: 'Pago / referencia', width: 48 },
      { header: 'Canje', width: 51 },
      { header: 'Total', width: 21 }
    ];
    const resolvedColumns = this.pdfLayout.resolveColumns(margin, columns);
    let y = 12;

    const drawHeader = (continuation = false): void => {
      const value = this.filterForm.value;
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title: 'Control diario de ventas',
        subtitle: `${value.dateFrom} a ${value.dateTo} - ${rows.length} venta(s)`,
        continuation,
        margin,
        y: 12,
        pageWidth
      });

      y = this.pdfLayout.drawTableHeader(doc, resolvedColumns, y, { tableWidth, fontSize: 6.8 });
    };

    drawHeader();

    rows.forEach((row, index) => {
      const values = [
        this.formatTime(row.createdAt),
        row.code || row.saleId.slice(0, 8),
        row.branchName,
        row.customerName,
        this.productsText(row.products),
        this.paymentsText(row.payments),
        this.tradeInsText(row.tradeIns),
        `$ ${this.money(row.totalAmount)}`
      ];
      const rowOptions = {
        tableWidth,
        wrap: true,
        minHeight: 7,
        lineHeight: 3,
        fontSize: 6.6,
        alternate: index % 2 === 0
      };
      const rowHeight = this.pdfLayout.measureTableRowHeight(doc, resolvedColumns, values, rowOptions);

      y = this.pdfLayout.ensurePageSpace(doc, y, rowHeight, pageHeight, () => {
        drawHeader(true);
        return y;
      }, 12);
      y = this.pdfLayout.drawTableRow(doc, resolvedColumns, values, y, { ...rowOptions, height: rowHeight });
    });

    const value = this.filterForm.value;
    this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, 'Control diario de ventas');
    doc.save(`control_ventas_${value.dateFrom}_${value.dateTo}.pdf`);
  }

  private toIso(date: Date): string {
    return date.toLocaleDateString('en-CA');
  }
}
