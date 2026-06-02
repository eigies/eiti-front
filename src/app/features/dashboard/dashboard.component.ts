import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { SaleResponse } from '../../core/models/sale.models';
import { PermissionCodes } from '../../core/models/permission.models';

interface DayBar {
  label: string;
  dateKey: string;
  total: number;
  count: number;
  heightPct: number;
  isToday: boolean;
}

interface DashboardAlert {
  tone: 'success' | 'warn' | 'danger';
  label: string;
  detail: string;
  statLabel?: string;
  statValue?: string;
  compareLabel?: string;
  compareValue?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;
  sales: SaleResponse[] = [];
  loading = true;
  selectedDayKey: string | null = null;
  selectedStatusKey: 'paid' | 'pending' | 'cancelled' | null = null;
  chartMetric: 'count' | 'amount' = 'count';

  constructor(
    public auth: AuthService,
    private saleService: SaleService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    this.saleService.listSales({ dateFrom, includeCuentaCorriente: true }).subscribe({
      next: sales => { this.sales = sales; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get canViewFinancials(): boolean {
    return this.auth.hasPermission(PermissionCodes.dashboardViewFinancials);
  }

  get username(): string {
    return this.auth.currentUser?.username ?? '';
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());
  }

  get todayKey(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  get yesterdayKey(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('en-CA');
  }

  get activeSales(): SaleResponse[] {
    return this.sales.filter(s => s.idSaleStatus !== 3);
  }

  get paidSales(): SaleResponse[] {
    return this.sales.filter(s => s.idSaleStatus === 2);
  }

  get pendingSales(): SaleResponse[] {
    return this.sales.filter(s => s.idSaleStatus === 1);
  }

  get cancelledSales(): SaleResponse[] {
    return this.sales.filter(s => s.idSaleStatus === 3);
  }

  private salesForDay(dateKey: string): SaleResponse[] {
    return this.sales.filter(s => new Date(s.createdAt).toLocaleDateString('en-CA') === dateKey);
  }

  private salesByStatus(statusKey: 'paid' | 'pending' | 'cancelled', sales: SaleResponse[]): SaleResponse[] {
    if (statusKey === 'paid') {
      return sales.filter(s => s.idSaleStatus === 2);
    }

    if (statusKey === 'pending') {
      return sales.filter(s => s.idSaleStatus === 1);
    }

    return sales.filter(s => s.idSaleStatus === 3);
  }

  get todaySales(): SaleResponse[] {
    return this.salesForDay(this.todayKey);
  }

  get todayActiveSales(): SaleResponse[] {
    return this.todaySales.filter(s => s.idSaleStatus !== 3);
  }

  get todayPaidSales(): SaleResponse[] {
    return this.todaySales.filter(s => s.idSaleStatus === 2);
  }

  get todayPendingSales(): SaleResponse[] {
    return this.todaySales.filter(s => s.idSaleStatus === 1);
  }

  get todayCancelledSales(): SaleResponse[] {
    return this.todaySales.filter(s => s.idSaleStatus === 3);
  }

  get todayRevenue(): number {
    return this.todayPaidSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  }

  get todayPendingRevenue(): number {
    return this.todayPendingSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  }

  get yesterdayRevenue(): number {
    return this.salesForDay(this.yesterdayKey)
      .filter(sale => sale.idSaleStatus === 2)
      .reduce((sum, sale) => sum + sale.totalAmount, 0);
  }

  get todayVsYesterdayDelta(): number {
    if (this.yesterdayRevenue === 0) {
      return this.todayRevenue > 0 ? 100 : 0;
    }

    return Math.round(((this.todayRevenue - this.yesterdayRevenue) / this.yesterdayRevenue) * 100);
  }

  get todayVsYesterdayLabel(): string {
    if (this.todayRevenue === 0 && this.yesterdayRevenue === 0) {
      return 'Mismo nivel que ayer';
    }

    if (this.yesterdayRevenue === 0 && this.todayRevenue > 0) {
      return 'Mas cobros que ayer';
    }

    if (this.todayVsYesterdayDelta > 0) {
      return `${this.todayVsYesterdayDelta}% mas cobrado que ayer`;
    }

    if (this.todayVsYesterdayDelta < 0) {
      return `${Math.abs(this.todayVsYesterdayDelta)}% menos cobrado que ayer`;
    }

    return 'Mismo nivel de cobro que ayer';
  }

  get scopeSales(): SaleResponse[] {
    const base = this.selectedDayKey ? this.salesForDay(this.selectedDayKey) : this.sales;
    return base.filter(s => s.idSaleStatus !== 3);
  }

  get scopePaidSales(): SaleResponse[] {
    const base = this.selectedDayKey ? this.salesForDay(this.selectedDayKey) : this.sales;
    return base.filter(s => s.idSaleStatus === 2);
  }

  get scopePendingSales(): SaleResponse[] {
    const base = this.selectedDayKey ? this.salesForDay(this.selectedDayKey) : this.sales;
    return base.filter(s => s.idSaleStatus === 1);
  }

  get totalRevenue(): number {
    return this.scopePaidSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }

  get pendingRevenue(): number {
    return this.scopePendingSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }

  get avgSaleValue(): number {
    if (this.scopeSales.length === 0) return 0;
    return this.scopeSales.reduce((sum, s) => sum + s.totalAmount, 0) / this.scopeSales.length;
  }

  get paidPct(): number {
    return this.sales.length === 0 ? 0 : Math.round(this.paidSales.length / this.sales.length * 100);
  }

  get pendingPct(): number {
    return this.sales.length === 0 ? 0 : Math.round(this.pendingSales.length / this.sales.length * 100);
  }

  get cancelledPct(): number {
    return this.sales.length === 0 ? 0 : Math.round(this.cancelledSales.length / this.sales.length * 100);
  }

  get recentSales(): SaleResponse[] {
    return [...this.sales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }

  get displayedSales(): SaleResponse[] {
    const baseSales = this.selectedDayKey
      ? this.salesForDay(this.selectedDayKey)
      : this.recentSales;
    const filteredByStatus = this.selectedStatusKey
      ? this.salesByStatus(this.selectedStatusKey, baseSales)
      : baseSales;

    return [...filteredByStatus]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get selectedDayLabel(): string {
    if (!this.selectedDayKey) return '';
    const d = new Date(this.selectedDayKey + 'T12:00:00');
    return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }

  get selectedStatusLabel(): string {
    if (this.selectedStatusKey === 'paid') return 'Pagadas';
    if (this.selectedStatusKey === 'pending') return 'En espera';
    if (this.selectedStatusKey === 'cancelled') return 'Canceladas';
    return '';
  }

  get monthTopLineLabel(): string {
    return this.selectedDayKey ? 'Lectura del dia filtrado' : 'Lectura del mes en curso';
  }

  get operationalAlerts(): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];
    const showMoney = this.canViewFinancials;

    if (this.todayActiveSales.length === 0) {
      alerts.push({
        tone: 'danger',
        label: 'Dia sin ventas',
        detail: 'Todavia no hay ventas activas registradas hoy.',
        statLabel: 'Hoy',
        statValue: '0 ventas'
      });
    }

    if (this.todayPendingSales.length >= 3) {
      alerts.push({
        tone: 'warn',
        label: 'Cobros en espera',
        detail: `${this.todayPendingSales.length} venta(s) siguen abiertas hoy.`,
        statLabel: showMoney ? 'Pendiente' : 'Ventas abiertas',
        statValue: showMoney
          ? this.todayPendingRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 })
          : String(this.todayPendingSales.length),
        compareLabel: showMoney ? 'Ventas abiertas' : undefined,
        compareValue: showMoney ? String(this.todayPendingSales.length) : undefined
      });
    }

    if (this.todayCancelledSales.length > 0) {
      alerts.push({
        tone: 'warn',
        label: 'Cancelaciones detectadas',
        detail: `${this.todayCancelledSales.length} venta(s) canceladas durante la jornada.`,
        statLabel: 'Canceladas hoy',
        statValue: String(this.todayCancelledSales.length)
      });
    }

    if (showMoney && this.todayRevenue > this.yesterdayRevenue && this.todayRevenue > 0) {
      alerts.push({
        tone: 'success',
        label: 'Ritmo superior a ayer',
        detail: this.todayVsYesterdayLabel.charAt(0).toUpperCase() + this.todayVsYesterdayLabel.slice(1) + '.',
        statLabel: 'Cobrado hoy',
        statValue: this.todayRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 }),
        compareLabel: 'Ayer',
        compareValue: this.yesterdayRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 })
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        tone: 'success',
        label: 'Operacion estable',
        detail: 'No hay desvíos operativos relevantes en este momento.',
        statLabel: showMoney ? 'Cobrado hoy' : 'Ventas activas',
        statValue: showMoney
          ? this.todayRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 })
          : String(this.todayActiveSales.length),
        compareLabel: showMoney ? 'Ventas activas' : undefined,
        compareValue: showMoney ? String(this.todayActiveSales.length) : undefined
      });
    }

    return alerts.slice(0, 3);
  }

  selectDay(bar: DayBar): void {
    this.selectedDayKey = this.selectedDayKey === bar.dateKey ? null : bar.dateKey;
  }

  selectStatus(statusKey: 'paid' | 'pending' | 'cancelled'): void {
    this.selectedStatusKey = this.selectedStatusKey === statusKey ? null : statusKey;
  }

  setChartMetric(metric: 'count' | 'amount'): void {
    if (metric === 'amount' && !this.canViewFinancials) {
      return;
    }
    this.chartMetric = metric;
  }

  get last7DaysBars(): DayBar[] {
    const todayKey = new Date().toLocaleDateString('en-CA');
    const bars: DayBar[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      const raw = new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(d);
      const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3);

      const daySales = this.activeSales.filter(s => new Date(s.createdAt).toLocaleDateString('en-CA') === key);
      const total = daySales.reduce((sum, s) => sum + s.totalAmount, 0);

      bars.push({ label, dateKey: key, total, count: daySales.length, heightPct: 0, isToday: key === todayKey });
    }

    const maxCount = Math.max(...bars.map(b => b.count), 1);
    const maxAmount = Math.max(...bars.map(b => b.total), 1);

    return bars.map(b => {
      const sourceValue = this.chartMetric === 'amount' ? b.total : b.count;
      const maxValue = this.chartMetric === 'amount' ? maxAmount : maxCount;

      return {
        ...b,
        heightPct: sourceValue > 0 ? Math.max(Math.round((sourceValue / maxValue) * 100), 5) : 0
      };
    });
  }

  saleStatusLabel(status: number): string {
    const map: Record<number, string> = { 1: 'En espera', 2: 'Pagada', 3: 'Cancelada' };
    return map[status] ?? 'Desconocido';
  }

  saleStatusClass(status: number): string {
    const map: Record<number, string> = { 1: 'st--pending', 2: 'st--paid', 3: 'st--cancelled' };
    return map[status] ?? '';
  }
}
