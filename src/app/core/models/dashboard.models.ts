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
  retailAmount: number;
  currentAccountCount: number;
  currentAccountAmount: number;
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  brand: string;
  units: number;
  salesCount: number;
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

export interface DashboardSummaryResponse {
  month: DashboardPeriodTotals;
  today: DashboardPeriodTotals;
  days: DashboardDayPoint[];
  topProducts: DashboardTopProduct[];
  collections: DashboardCollections;
  todayStatus: DashboardTodayStatus;
  recentSales: DashboardRecentSale[];
}

export type DashboardChartSegment = 'both' | 'retail' | 'cc';
export type DashboardChartMetric = 'count' | 'amount' | 'products';
