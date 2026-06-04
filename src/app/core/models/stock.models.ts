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

export interface StockMovementResponse {
    id: string;
    type: number;
    typeName: string;
    quantity: number;
    referenceType?: string | null;
    referenceId?: string | null;
    description?: string | null;
    createdAt: string;
}
