export interface BranchProductStockResponse {
    productId: string;
    branchId: string;
    code: string;
    sku: string;
    brand: string;
    name: string;
    price: number;
    publicPrice?: number | null;
    costPrice?: number | null;
    unitPrice?: number | null;
    allowsManualValueInSale: boolean;
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    updatedAt?: string | null;
    // Overrides por sucursal (null = usa el valor global) + valores efectivos resueltos.
    costOverride?: number | null;
    salePriceOverride?: number | null;
    effectivePrice?: number;
    effectiveCost?: number;
}

export interface SetBranchProductPricingRequest {
    branchId: string;
    productId: string;
    costOverride?: number | null;
    salePriceOverride?: number | null;
}

export interface AdjustStockRequest {
    branchId: string;
    productId: string;
    quantity: number;
    type: number;
    description?: string | null;
}

export interface TransferStockItemRequest {
    productId: string;
    quantity: number;
}

export interface TransferStockRequest {
    sourceBranchId: string;
    destinationBranchId: string;
    items: TransferStockItemRequest[];
    description?: string | null;
}

export interface TransferStockResultItem {
    productId: string;
    code: string;
    name: string;
    quantity: number;
    sourceOnHandQuantity: number;
    sourceAvailableQuantity: number;
}

export interface TransferStockResponse {
    sourceBranchId: string;
    destinationBranchId: string;
    items: TransferStockResultItem[];
}

export interface TransferDetailItem {
    code: string;
    brand: string;
    name: string;
    quantity: number;
}

export interface TransferDetailResponse {
    referenceId: string;
    date: string;
    fromBranchId?: string | null;
    fromBranchName?: string | null;
    toBranchId?: string | null;
    toBranchName?: string | null;
    description?: string | null;
    items: TransferDetailItem[];
}

export interface StockMovementResponse {
    id: string;
    type: number;
    typeName: string;
    quantity: number;
    referenceType?: string | null;
    referenceId?: string | null;
    description?: string | null;
    createdAt: string;
    referenceCode?: string | null;
}

export interface ProductReservationItem {
    saleId: string;
    saleCode?: string | null;
    branchId: string;
    branchName: string;
    customerName: string;
    isCuentaCorriente: boolean;
    quantity: number;
    pendingAmount: number;
    createdAt: string;
}

export interface ProductReservationsResponse {
    productId: string;
    branchId?: string | null;
    totalReserved: number;
    items: ProductReservationItem[];
}
