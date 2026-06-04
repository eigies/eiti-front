import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SalesReportTotals } from '../../../core/models/report.models';

interface MetricRow { label: string; a: number; b: number; delta: number; money: boolean; }

@Component({
  selector: 'app-comparison-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './comparison-report.component.html',
  styleUrls: ['../reports.shared.css', './comparison-report.component.css']
})
export class ComparisonReportComponent {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  totalsA: SalesReportTotals | null = null;
  totalsB: SalesReportTotals | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly toast: ToastService
  ) {
    const today = this.toIso(new Date());
    const firstThis = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const firstPrev = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const lastPrev = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
    this.filterForm = this.fb.group({
      aFrom: [firstPrev, Validators.required],
      aTo: [lastPrev, Validators.required],
      bFrom: [firstThis, Validators.required],
      bTo: [today, Validators.required]
    });
  }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  get rows(): MetricRow[] {
    if (!this.totalsA || !this.totalsB) return [];
    const a = this.totalsA, b = this.totalsB;
    return [
      { label: 'Ventas', a: a.salesCount, b: b.salesCount, delta: this.pct(a.salesCount, b.salesCount), money: false },
      { label: 'Unidades', a: a.units, b: b.units, delta: this.pct(a.units, b.units), money: false },
      { label: 'Facturación', a: a.revenue, b: b.revenue, delta: this.pct(a.revenue, b.revenue), money: true },
      { label: 'Costo', a: a.cost, b: b.cost, delta: this.pct(a.cost, b.cost), money: true },
      { label: 'Ganancia', a: a.profit, b: b.profit, delta: this.pct(a.profit, b.profit), money: true },
      { label: 'Margen %', a: a.marginPct, b: b.marginPct, delta: this.round(b.marginPct - a.marginPct), money: false }
    ];
  }

  search(): void {
    if (this.filterForm.invalid) { this.filterForm.markAllAsTouched(); this.toast.error('Completá ambos rangos de fechas.'); return; }
    const v = this.filterForm.value;
    if (v.aFrom > v.aTo || v.bFrom > v.bTo) { this.toast.error('En cada rango, la fecha desde no puede ser posterior a la hasta.'); return; }

    this.loading = true;
    this.hasSearched = true;
    forkJoin({
      a: this.reportService.salesReport({ dateFrom: v.aFrom, dateTo: v.aTo, groupBy: 'total' }),
      b: this.reportService.salesReport({ dateFrom: v.bFrom, dateTo: v.bTo, groupBy: 'total' })
    }).subscribe({
      next: ({ a, b }) => { this.totalsA = a.totals; this.totalsB = b.totals; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo generar el comparativo.'); }
    });
  }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmt(value: number, money: boolean): string { return money ? '$ ' + this.money(value) : String(value); }
  rangeLabel(fromField: string, toField: string): string {
    return `${this.formatDateOnly(this.filterForm.get(fromField)?.value)} - ${this.formatDateOnly(this.filterForm.get(toField)?.value)}`;
  }

  private pct(a: number, b: number): number {
    if (a === 0) return b === 0 ? 0 : 100;
    return this.round((b - a) / Math.abs(a) * 100);
  }
  private formatDateOnly(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }
  private round(n: number): number { return Math.round(n * 100) / 100; }
  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
}
