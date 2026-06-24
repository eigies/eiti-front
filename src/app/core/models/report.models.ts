export interface StockMatrixBranch {
    id: string;
    name: string;
}

export interface StockMatrixRow {
    productId: string;
    code: string;
    brand: string;
    name: string;
    available: number[];
    total: number;
}

export interface StockMatrixResponse {
    branches: StockMatrixBranch[];
    rows: StockMatrixRow[];
}

export interface SalesReportRow {
    key: string;
    label: string;
    subKey: string | null;
    subLabel: string | null;
    salesCount: number;
    units: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
}

export interface SalesReportTotals {
    salesCount: number;
    units: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
}

export interface SalesReportResponse {
    groupBy: string;
    rows: SalesReportRow[];
    totals: SalesReportTotals;
}

export interface SalesReportFilters {
    dateFrom: string;
    dateTo: string;
    groupBy: string;
    customerId?: string | null;
    installerId?: string | null;
    vehicleId?: string | null;
    channel?: number | null;
    deliveryMode?: 'all' | 'with' | 'without' | null;
    categoryId?: string | null;
    saleType?: 'all' | 'wholesale' | 'retail' | null;
    branchId?: string | null;
}

export interface CustomerDebtorRow {
    customerId: string;
    customerName: string;
    openSalesCount: number;
    oldestDate: string;
    owed: number;
    creditBalance: number;
    net: number;
}

export interface CustomerDebtorsResponse {
    rows: CustomerDebtorRow[];
    totalOwed: number;
    totalCredit: number;
    totalNet: number;
}

export interface CashMovementItem {
    date: string;
    description: string;
    amount: number;
    userName: string | null;
}

export interface CashMovementCategory {
    motivo: string;
    typeCode: number;
    total: number;
    count: number;
    items: CashMovementItem[];
}

export interface CashMovementsReportResponse {
    categories: CashMovementCategory[];
    totalGeneral: number;
}

export interface PaymentMethodsReportSubgroup {
    label: string;
    cardBankId: number | null;
    cardCuotas: number | null;
    count: number;
    total: number;
    percent: number;
}

export interface PaymentMethodsReportRow {
    methodId: number;
    methodLabel: string;
    count: number;
    total: number;
    percent: number;
    subgroups: PaymentMethodsReportSubgroup[];
}

export interface PaymentMethodsReportTotals {
    count: number;
    total: number;
}

export interface PaymentMethodsReportResponse {
    rows: PaymentMethodsReportRow[];
    totals: PaymentMethodsReportTotals;
}

export interface DailySalesProductItem {
    productId: string;
    code: string;
    brand: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
}

export interface DailySalesPaymentItem {
    methodCode: number;
    method: string;
    amount: number;
    reference: string | null;
}

export interface DailySalesTradeInItem {
    productId: string;
    code: string;
    brand: string;
    name: string;
    quantity: number;
    amount: number;
}

export interface DailySalesControlRow {
    saleId: string;
    code: string | null;
    createdAt: string;
    branchId: string;
    branchName: string;
    customerId: string | null;
    customerName: string;
    statusCode: number;
    status: string;
    isCuentaCorriente: boolean;
    totalAmount: number;
    products: DailySalesProductItem[];
    payments: DailySalesPaymentItem[];
    tradeIns: DailySalesTradeInItem[];
}

export interface DailySalesControlTotals {
    salesCount: number;
    unitsSold: number;
    salesWithTradeIn: number;
    totalAmount: number;
}

export interface DailySalesControlResponse {
    rows: DailySalesControlRow[];
    totals: DailySalesControlTotals;
}

export const SALE_CHANNELS: { value: number; label: string }[] = [
    { value: 1, label: 'Referido' },
    { value: 2, label: 'WhatsApp' },
    { value: 3, label: 'Facebook' },
    { value: 4, label: 'Web' },
    { value: 5, label: 'Instagram' },
    { value: 6, label: 'Otro' },
    { value: 7, label: 'Cliente anterior' },
    { value: 8, label: 'MercadoLibre' },
    { value: 9, label: 'Google' },
    { value: 10, label: 'Sin canal' }
];
