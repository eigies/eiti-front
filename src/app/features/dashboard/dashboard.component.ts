import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;
  sales: SaleResponse[] = [];
  loading = true;
  selectedDayKey: string | null = null;

  constructor(
    public auth: AuthService,
    private saleService: SaleService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    this.saleService.listSales({ dateFrom }).subscribe({
      next: sales => { this.sales = sales; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get username(): string {
    return this.auth.currentUser?.username ?? '';
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());
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
    if (!this.selectedDayKey) return this.recentSales;
    return [...this.sales]
      .filter(s => new Date(s.createdAt).toLocaleDateString('en-CA') === this.selectedDayKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get selectedDayLabel(): string {
    if (!this.selectedDayKey) return '';
    const d = new Date(this.selectedDayKey + 'T12:00:00');
    return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }

  selectDay(bar: DayBar): void {
    this.selectedDayKey = this.selectedDayKey === bar.dateKey ? null : bar.dateKey;
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

    const max = Math.max(...bars.map(b => b.count), 1);
    return bars.map(b => ({ ...b, heightPct: b.count > 0 ? Math.max(Math.round(b.count / max * 100), 5) : 0 }));
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
