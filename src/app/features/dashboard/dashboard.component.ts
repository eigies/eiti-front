import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { BranchResponse } from '../../core/models/branch.models';
import {
  DashboardChartMetric,
  DashboardChartView,
  DashboardCumulativePoint,
  DashboardChartSegment,
  DashboardDayPoint,
  DashboardProductRanking,
  DashboardRecentSale,
  DashboardSaleResponse,
  DashboardSummaryResponse,
  DashboardTopProduct
} from '../../core/models/dashboard.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { ProductCategoryResponse } from '../../core/models/product-category.models';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { DashboardPreferencesService } from '../../core/services/dashboard-preferences.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { ToastService } from '../../shared/services/toast.service';

interface DashboardAlert {
  tone: 'success' | 'warn' | 'danger';
  label: string;
  detail: string;
}

interface DashboardSaleItem {
  id: string;
  code?: string | null;
  createdAt: string;
  customerName: string;
  status: number;
  totalAmount: number;
  isCuentaCorriente: boolean;
}

interface DashboardChartDay extends DashboardDayPoint {
  dateKey: string;
  label: string;
  isToday: boolean;
  retailHeight: number;
  currentAccountHeight: number;
}

interface RankedProduct extends DashboardTopProduct {
  sharePct: number;
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
  summary: DashboardSummaryResponse | null = null;
  branches: BranchResponse[] = [];
  categories: ProductCategoryResponse[] = [];
  categoryIds: string[] = [];
  categoryPanelOpen = false;
  loading = true;
  loadFailed = false;
  branchId: string | null = null;
  chartSegment: DashboardChartSegment = 'both';
  chartMetric: DashboardChartMetric = 'count';
  chartView: DashboardChartView = 'days';
  selectedDayKey: string | null = null;
  selectedStatusKey: 'paid' | 'pending' | 'cancelled' | null = null;
  drillDownSales: DashboardSaleResponse[] = [];
  drillDownLoading = false;
  private summaryRequestId = 0;
  private drillDownRequestId = 0;

  constructor(
    public readonly auth: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly preferences: DashboardPreferencesService,
    private readonly branchService: BranchService,
    private readonly productCategoryService: ProductCategoryService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.chartSegment = this.preferences.readChartSegment();
    this.chartView = this.preferences.readChartView();
    const storedMetric = this.preferences.readChartMetric();
    this.chartMetric = storedMetric === 'amount' && !this.canViewFinancials
      ? 'count'
      : storedMetric;

    // Sucursales y categorias en paralelo: las dos alimentan filtros y ninguna depende de la otra.
    forkJoin({
      branches: this.branchService.listBranches().pipe(catchError(() => of([] as BranchResponse[]))),
      categories: this.productCategoryService.list()
        .pipe(catchError(() => of([] as ProductCategoryResponse[])))
    }).subscribe(({ branches, categories }) => {
      this.branches = branches;
      this.branchId = branches.length > 0
        ? this.preferences.readBranchId(
            branches.map(branch => branch.id),
            this.canViewAllBranches
          )
        : null;

      this.categories = categories;
      this.categoryIds = this.preferences.readCategoryIds(categories.map(c => c.id));

      this.loadSummary();
    });
  }

  toggleCategoryPanel(): void {
    this.categoryPanelOpen = !this.categoryPanelOpen;
  }

  /** Resume el filtro en el boton: sin abrirlo se entiende que esta contando. */
  get categoryFilterLabel(): string {
    if (!this.hasCategoryFilter) {
      return 'Todo el catálogo';
    }
    if (this.categoryIds.length === 1) {
      return this.categories.find(c => c.id === this.categoryIds[0])?.name ?? '1 categoría';
    }
    return `${this.categoryIds.length} categorías`;
  }

  /** Categorías activas del filtro. Vacío = sin filtro, cuenta todo el catálogo. */
  get hasCategoryFilter(): boolean {
    return this.categoryIds.length > 0;
  }

  isCategorySelected(id: string): boolean {
    return this.categoryIds.includes(id);
  }

  toggleCategory(id: string): void {
    this.categoryIds = this.isCategorySelected(id)
      ? this.categoryIds.filter(current => current !== id)
      : [...this.categoryIds, id];
    this.preferences.writeCategoryIds(this.categoryIds);
    this.clearExploration();
    this.loadSummary();
  }

  clearCategories(): void {
    if (!this.hasCategoryFilter) {
      return;
    }
    this.categoryIds = [];
    this.preferences.writeCategoryIds([]);
    this.clearExploration();
    this.loadSummary();
  }

  get canViewFinancials(): boolean {
    return this.auth.hasPermission(PermissionCodes.dashboardViewFinancials);
  }

  get canViewAllBranches(): boolean {
    return this.auth.currentUser?.canViewAllBranches
      ?? this.auth.hasPermission(PermissionCodes.branchesViewAll);
  }

  get username(): string {
    return this.auth.currentUser?.username ?? '';
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  get chartTitle(): string {
    if (this.chartView === 'products') {
      return this.selectedDayKey
        ? `Productos del ${this.selectedDayLabel}`
        : 'Productos con mayor salida';
    }
    if (this.chartView === 'comparison') {
      return `${this.comparisonCurrentLabel} contra ${this.comparisonPreviousLabel.toLowerCase()}`;
    }
    return 'Ritmo comercial · últimos 7 días';
  }

  get chartSubtitle(): string {
    if (this.chartView === 'products') {
      // Dos cosas que el panel no muestra solo y hacen que no cierre contra el reporte de
      // ventas: que ordena por unidades aunque se esté mirando ventas, y que son cinco de
      // todos los productos del día, no todos.
      return `Top 5 por unidades vendidas · ${this.segmentLabel.toLowerCase()}`;
    }
    if (this.chartView === 'comparison') {
      return 'Acumulado del mes contra el mismo tramo del anterior';
    }
    if (this.chartMetric === 'amount') {
      return 'Facturación por día y segmento';
    }
    return this.chartMetric === 'units'
      ? 'Unidades vendidas por día y segmento'
      : 'Ventas por día y segmento';
  }

  private get segmentLabel(): string {
    if (this.chartSegment === 'retail') return 'Minorista';
    if (this.chartSegment === 'cc') return 'Cuenta corriente';
    return 'Minorista y cuenta corriente';
  }

  /** El chip de segmento no aplica a la comparativa: el backend no la parte por tipo de venta. */
  get showsSegmentToggle(): boolean {
    return this.chartView !== 'comparison';
  }

  /** El ranking siempre ordena por unidades, así que la métrica no cambia nada ahí. */
  get showsMetricToggle(): boolean {
    return this.chartView !== 'products';
  }

  get selectedDayLabel(): string {
    if (!this.selectedDayKey) {
      return '';
    }
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date(`${this.selectedDayKey}T12:00:00`));
  }

  get selectedStatusLabel(): string {
    if (this.selectedStatusKey === 'paid') return 'Pagadas';
    if (this.selectedStatusKey === 'pending') return 'En espera';
    if (this.selectedStatusKey === 'cancelled') return 'Canceladas';
    return '';
  }

  get chartDays(): DashboardChartDay[] {
    const days = this.summary?.days ?? [];
    const values = days.flatMap(day => [
      this.chartValue(day, 'retail'),
      this.chartValue(day, 'cc')
    ]);
    const max = Math.max(...values, 1);
    const todayKey = this.localDateKey(new Date());

    return days.map(day => {
      const dateKey = day.date.slice(0, 10);
      const rawLabel = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })
        .format(new Date(`${dateKey}T12:00:00`));
      return {
        ...day,
        dateKey,
        label: rawLabel.slice(0, 3),
        isToday: dateKey === todayKey,
        retailHeight: this.barHeight(this.chartValue(day, 'retail'), max),
        currentAccountHeight: this.barHeight(this.chartValue(day, 'cc'), max)
      };
    });
  }

  /** Vista que dibuja las series minorista/CC por dia. La comparativa y el ranking no. */
  get isSeriesView(): boolean {
    return this.chartView === 'days';
  }

  private monthLabel(iso: string): string {
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long' })
      .format(new Date(`${iso.slice(0, 10)}T12:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get comparisonCurrentLabel(): string {
    return this.summary ? this.monthLabel(this.summary.monthComparison.currentMonth) : '';
  }

  get comparisonPreviousLabel(): string {
    return this.summary ? this.monthLabel(this.summary.monthComparison.previousMonth) : '';
  }

  /** El valor que se grafica depende de si el usuario está mirando ventas, unidades o monto. */
  private cumulativeValue(point: DashboardCumulativePoint): number {
    if (this.chartMetric === 'amount') return point.amount;
    return this.chartMetric === 'units' ? point.units : point.count;
  }

  private comparisonTotal(points: DashboardCumulativePoint[]): number {
    return points.length === 0 ? 0 : this.cumulativeValue(points[points.length - 1]);
  }

  /**
   * Las dos curvas comparten escala, si no la comparacion visual mentiría. El viewBox es
   * 100x46 y se dibuja invertido en Y porque en SVG el origen esta arriba.
   */
  get comparisonPath(): { current: string; previous: string } {
    const comparison = this.summary?.monthComparison;
    if (!comparison || comparison.current.length === 0) {
      return { current: '', previous: '' };
    }

    const max = Math.max(
      ...comparison.current.map(p => this.cumulativeValue(p)),
      ...comparison.previous.map(p => this.cumulativeValue(p)),
      1
    );
    const lastDay = Math.max(comparison.daysElapsed - 1, 1);

    const toPath = (points: DashboardCumulativePoint[]): string => points
      .map((point, index) => {
        const x = (index / lastDay) * 100;
        const y = 44 - (this.cumulativeValue(point) / max) * 42;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    return { current: toPath(comparison.current), previous: toPath(comparison.previous) };
  }

  /** Diferencia porcentual del tramo corriente contra el mismo tramo del mes anterior. */
  get comparisonDelta(): number {
    const comparison = this.summary?.monthComparison;
    if (!comparison) {
      return 0;
    }
    const current = this.comparisonTotal(comparison.current);
    const previous = this.comparisonTotal(comparison.previous);
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  get comparisonVerdict(): string {
    const comparison = this.summary?.monthComparison;
    if (!comparison) {
      return '';
    }
    const current = this.comparisonTotal(comparison.current);
    const previous = this.comparisonTotal(comparison.previous);
    const unit = this.chartMetric === 'amount'
      ? ''
      : this.chartMetric === 'units' ? ' unidades' : ' ventas';
    const format = (value: number): string => this.chartMetric === 'amount'
      ? value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 })
      : `${value}${unit}`;

    if (previous === 0 && current === 0) {
      return `Sin actividad en los primeros ${comparison.daysElapsed} días de ninguno de los dos meses.`;
    }
    if (previous === 0) {
      return `${format(current)} en ${this.comparisonCurrentLabel}, contra nada en el mismo tramo de ${this.comparisonPreviousLabel.toLowerCase()}.`;
    }

    const delta = this.comparisonDelta;
    const direction = delta > 0 ? 'por encima' : delta < 0 ? 'por debajo' : 'al mismo nivel';
    const suffix = delta === 0 ? '' : ` (${Math.abs(delta)}%)`;
    return `${format(current)} contra ${format(previous)}: ${direction}${suffix} del mismo tramo de ${this.comparisonPreviousLabel.toLowerCase()}.`;
  }

  get comparisonSummaryLabel(): string {
    return `Acumulado de ${this.comparisonCurrentLabel} comparado con ${this.comparisonPreviousLabel}`;
  }

  /**
   * El ranking sigue los mismos filtros que el resto del panel: el día seleccionado en las barras
   * y el segmento minorista/CC. Antes era siempre el del mes entero con los dos segmentos juntos,
   * así que no cerraba contra el reporte de ventas ni contra las barras de al lado.
   */
  private get activeRanking(): DashboardProductRanking | null {
    if (!this.summary) {
      return null;
    }
    if (!this.selectedDayKey) {
      return this.summary.topProducts;
    }
    // El día viene de las barras, así que siempre cae dentro de la serie; el fallback cubre el
    // caso de que la selección sobreviva a una recarga que ya no incluye ese día.
    const ofDay = this.summary.dayRankings
      .find(day => day.date.slice(0, 10) === this.selectedDayKey);
    return ofDay?.products ?? this.summary.topProducts;
  }

  get rankedProducts(): RankedProduct[] {
    const ranking = this.activeRanking;
    if (!ranking) {
      return [];
    }

    const products = this.chartSegment === 'retail'
      ? ranking.retail
      : this.chartSegment === 'cc' ? ranking.currentAccount : ranking.total;

    const maxUnits = Math.max(...products.map(product => product.units), 1);
    return products.map(product => ({
      ...product,
      sharePct: Math.max(Math.round((product.units / maxUnits) * 100), 6)
    }));
  }

  get displayedSales(): DashboardSaleItem[] {
    const base = this.selectedDayKey || this.selectedStatusKey
      ? this.drillDownSales.map(sale => this.mapDashboardSale(sale))
      : (this.summary?.recentSales ?? []).map(sale => this.mapRecentSale(sale));
    const filtered = this.selectedStatusKey
      ? base.filter(sale => sale.status === this.statusValue(this.selectedStatusKey!))
      : base;

    return [...filtered].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  get operationalAlerts(): DashboardAlert[] {
    const status = this.summary?.todayStatus;
    if (!status) {
      return [];
    }

    const alerts: DashboardAlert[] = [];
    if (status.activeCount === 0) {
      alerts.push({
        tone: 'danger',
        label: 'Día sin ventas',
        detail: 'Todavía no hay ventas activas registradas hoy.'
      });
    }
    if (status.pendingCount >= 3) {
      alerts.push({
        tone: 'warn',
        label: 'Cobros en espera',
        detail: `${status.pendingCount} ventas siguen abiertas durante la jornada.`
      });
    }
    if (status.cancelledCount > 0) {
      alerts.push({
        tone: 'warn',
        label: 'Cancelaciones detectadas',
        detail: `${status.cancelledCount} ventas fueron canceladas hoy.`
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        tone: 'success',
        label: 'Operación estable',
        detail: 'No hay desvíos operativos relevantes en este momento.'
      });
    }
    return alerts.slice(0, 3);
  }

  loadSummary(): void {
    const requestId = ++this.summaryRequestId;
    this.loading = true;
    this.loadFailed = false;
    const now = new Date();
    const dateFrom = this.localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const dateTo = this.localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    this.dashboardService.getSummary(dateFrom, dateTo, this.branchId, this.categoryIds).subscribe({
      next: summary => {
        if (requestId !== this.summaryRequestId) return;
        this.summary = summary;
        this.loading = false;
      },
      error: (error: { error?: { detail?: string } }) => {
        if (requestId !== this.summaryRequestId) return;
        this.loading = false;
        this.loadFailed = true;
        this.toast.error(error?.error?.detail || 'No se pudo cargar el dashboard.');
      }
    });
  }

  setBranch(id: string | null): void {
    if (this.branchId === id) {
      return;
    }
    this.branchId = id;
    this.preferences.writeBranchId(id);
    this.clearExploration();
    this.loadSummary();
  }

  setChartSegment(segment: DashboardChartSegment): void {
    this.chartSegment = segment;
    this.preferences.writeChartSegment(segment);
  }

  setChartMetric(metric: DashboardChartMetric): void {
    if (metric === 'amount' && !this.canViewFinancials) {
      return;
    }
    this.chartMetric = metric;
    this.preferences.writeChartMetric(metric);
  }

  setChartView(view: DashboardChartView): void {
    this.chartView = view;
    this.preferences.writeChartView(view);
  }

  selectDay(dateKey: string): void {
    if (this.selectedDayKey === dateKey) {
      this.selectedDayKey = null;
      if (this.selectedStatusKey) {
        this.loadDashboardSales(this.localDateKey(new Date()));
      } else {
        this.clearDrillDown();
      }
      return;
    }

    this.selectedDayKey = dateKey;
    this.loadDashboardSales(dateKey);
  }

  selectStatus(status: 'paid' | 'pending' | 'cancelled'): void {
    this.selectedStatusKey = this.selectedStatusKey === status ? null : status;
    if (this.selectedDayKey) {
      return;
    }
    if (this.selectedStatusKey) {
      this.loadDashboardSales(this.localDateKey(new Date()));
    } else {
      this.clearDrillDown();
    }
  }

  clearDay(): void {
    this.selectedDayKey = null;
    if (this.selectedStatusKey) {
      this.loadDashboardSales(this.localDateKey(new Date()));
    } else {
      this.clearDrillDown();
    }
  }

  private loadDashboardSales(dateKey: string): void {
    const requestId = ++this.drillDownRequestId;
    this.drillDownLoading = true;
    this.dashboardService.listSales(dateKey, dateKey, this.branchId).subscribe({
      next: sales => {
        if (requestId !== this.drillDownRequestId) return;
        this.drillDownSales = sales;
        this.drillDownLoading = false;
      },
      error: (error: { error?: { detail?: string } }) => {
        if (requestId !== this.drillDownRequestId) return;
        this.drillDownSales = [];
        this.drillDownLoading = false;
        this.toast.error(error?.error?.detail || 'No se pudieron cargar las ventas del día.');
      }
    });
  }

  chartValue(day: DashboardDayPoint, segment: 'retail' | 'cc'): number {
    if (segment === 'retail') {
      if (this.chartMetric === 'amount') return day.retailAmount;
      return this.chartMetric === 'units' ? day.retailUnits : day.retailCount;
    }
    if (this.chartMetric === 'amount') return day.currentAccountAmount;
    return this.chartMetric === 'units' ? day.currentAccountUnits : day.currentAccountCount;
  }

  saleStatusLabel(status: number): string {
    const labels: Record<number, string> = { 1: 'En espera', 2: 'Pagada', 3: 'Cancelada' };
    return labels[status] ?? 'Desconocido';
  }

  saleStatusClass(status: number): string {
    const classes: Record<number, string> = {
      1: 'st--pending',
      2: 'st--paid',
      3: 'st--cancelled'
    };
    return classes[status] ?? '';
  }

  private barHeight(value: number, max: number): number {
    return value > 0 ? Math.max(Math.round((value / max) * 100), 5) : 0;
  }

  private clearExploration(): void {
    this.selectedDayKey = null;
    this.selectedStatusKey = null;
    this.drillDownSales = [];
    this.drillDownLoading = false;
    this.drillDownRequestId++;
  }

  private clearDrillDown(): void {
    this.drillDownRequestId++;
    this.drillDownSales = [];
    this.drillDownLoading = false;
  }

  private mapDashboardSale(sale: DashboardSaleResponse): DashboardSaleItem {
    return {
      id: sale.id,
      code: sale.code,
      createdAt: sale.createdAt,
      customerName: sale.customerName || 'Consumidor final',
      status: sale.saleStatus,
      totalAmount: sale.totalAmount,
      isCuentaCorriente: sale.isCuentaCorriente
    };
  }

  private mapRecentSale(sale: DashboardRecentSale): DashboardSaleItem {
    return {
      id: sale.id,
      code: sale.code,
      createdAt: sale.createdAt,
      customerName: sale.customerName,
      status: sale.saleStatus,
      totalAmount: sale.totalAmount,
      isCuentaCorriente: sale.isCuentaCorriente
    };
  }

  private statusValue(status: 'paid' | 'pending' | 'cancelled'): number {
    return status === 'paid' ? 2 : status === 'pending' ? 1 : 3;
  }

  private localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
