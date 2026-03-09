export interface BranchProductStockResponse {
    productId: string;
    branchId: string;
    code: string;
    sku: string;
    brand: string;
    name: string;
    price: number;
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
