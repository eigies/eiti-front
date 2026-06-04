import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CustomerDebtorsResponse } from '../../../core/models/report.models';

@Component({
  selector: 'app-debtors-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debtors-report.component.html',
  styleUrls: ['../reports.shared.css']
})
export class DebtorsReportComponent implements OnInit {
  loading = false;
  data: CustomerDebtorsResponse | null = null;

  constructor(private readonly reportService: ReportService, private readonly toast: ToastService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.reportService.customerDebtors().subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  formatDate(value: string): string { return new Date(value).toLocaleDateString('es-AR'); }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const rows = this.data.rows.map(r => ({
      'Cliente': r.customerName,
      'Ventas abiertas': r.openSalesCount,
      'Más antigua': this.formatDate(r.oldestDate),
      'Adeudado': r.owed,
      'A favor': r.creditBalance,
      'Neto': r.net
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deudores');
    XLSX.writeFile(wb, `clientes_deudores_${new Date().toLocaleDateString('en-CA')}.xlsx`, { compression: true });
  }
}
