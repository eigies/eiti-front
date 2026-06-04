import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CashMovementsReportResponse } from '../../../core/models/report.models';

@Component({
  selector: 'app-cash-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cash-report.component.html',
  styleUrls: ['../reports.shared.css', './cash-report.component.css']
})
export class CashReportComponent implements OnInit {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  data: CashMovementsReportResponse | null = null;
  expanded: Record<number, boolean> = {};

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly toast: ToastService
  ) {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm = this.fb.group({
      dateFrom: [firstOfMonth, Validators.required],
      dateTo: [today, Validators.required]
    });
  }

  ngOnInit(): void { this.search(); }

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
    this.reportService.cashMovements(v.dateFrom, v.dateTo).subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  toggle(typeCode: number): void { this.expanded[typeCode] = !this.expanded[typeCode]; }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  formatDate(value: string): string { return new Date(value).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }

  exportExcel(): void {
    if (!this.data || this.data.categories.every(c => c.count === 0)) { this.toast.error('No hay movimientos para exportar.'); return; }
    const rows: Record<string, unknown>[] = [];
    for (const cat of this.data.categories) {
      for (const it of cat.items) {
        rows.push({ 'Motivo': cat.motivo, 'Fecha': this.formatDate(it.date), 'Descripción': it.description, 'Monto': it.amount, 'Usuario': it.userName ?? '' });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Caja');
    const f = this.filterForm.value;
    XLSX.writeFile(wb, `caja_motivos_${f.dateFrom}_${f.dateTo}.xlsx`, { compression: true });
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
}
