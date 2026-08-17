export interface DashboardSegment {
  /** Operaciones. Con filtro de categoría, ventas que incluyen al menos una unidad de esas categorías. */
  count: number;
  /** Unidades vendidas. Es lo comparable contra el reporte de ventas, que también cuenta unidades. */
  units: number;
  amount: number;
}

export interface DashboardPeriodTotals {
  total: DashboardSegment;
  retail: DashboardSegment;
  currentAccount: DashboardSegment;
}

export interface DashboardDayPoint {
  date: string;
  retailCount: number;
  retailUnits: number;
  retailAmount: number;
  currentAccountCount: number;
  currentAccountUnits: number;
  currentAccountAmount: number;
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  brand: string;
  units: number;
  salesCount: number;
}

/**
 * El ranking viene partido por segmento porque el chip Minorista/CC es local al front: sin las
 * tres listas, cambiar de segmento seguiría mostrando el ranking de todo.
 */
export interface DashboardProductRanking {
  total: DashboardTopProduct[];
  retail: DashboardTopProduct[];
  currentAccount: DashboardTopProduct[];
}

/** Un ranking por cada día de la serie, para que seleccionar un día acote también el ranking. */
export interface DashboardDayRanking {
  date: string;
  products: DashboardProductRanking;
}

export interface DashboardCollections {
  paidAmount: number;
  paidCount: number;
  pendingAmount: number;
  pendingCount: number;
  avgTicket: number;
}

export interface DashboardTodayStatus {
  activeCount: number;
  paidCount: number;
  pendingCount: number;
  cancelledCount: number;
}

export interface DashboardRecentSale {
  id: string;
  code?: string | null;
  createdAt: string;
  customerName: string;
  saleStatus: number;
  totalAmount: number;
  isCuentaCorriente: boolean;
}

export interface DashboardSaleResponse {
  id: string;
  code?: string | null;
  createdAt: string;
  customerName: string;
  saleStatus: number;
  totalAmount: number;
  isCuentaCorriente: boolean;
}

/** Valores ACUMULADOS al cierre de ese día del mes, no el movimiento del día. */
export interface DashboardCumulativePoint {
  dayOfMonth: number;
  count: number;
  units: number;
  amount: number;
}

/**
 * Acumulado del mes contra el mismo tramo del mes anterior. Las dos series se cortan en el
 * mismo día (`daysElapsed`): comparar un mes entero contra uno a mitad de camino diría
 * siempre que se viene peor.
 */
export interface DashboardMonthComparison {
  currentMonth: string;
  previousMonth: string;
  daysElapsed: number;
  current: DashboardCumulativePoint[];
  previous: DashboardCumulativePoint[];
}

export interface DashboardSummaryResponse {
  month: DashboardPeriodTotals;
  today: DashboardPeriodTotals;
  days: DashboardDayPoint[];
  topProducts: DashboardProductRanking;
  dayRankings: DashboardDayRanking[];
  collections: DashboardCollections;
  todayStatus: DashboardTodayStatus;
  recentSales: DashboardRecentSale[];
  monthComparison: DashboardMonthComparison;
}

export type DashboardChartSegment = 'both' | 'retail' | 'cc';

/** QUÉ se mide. Aplica a las tres vistas. */
export type DashboardChartMetric = 'count' | 'units' | 'amount';

/** CÓMO se muestra. Antes vivía mezclado con la métrica en un solo grupo de chips. */
export type DashboardChartView = 'days' | 'comparison' | 'products';
