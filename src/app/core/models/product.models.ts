export interface CreateProductRequest {
    code: string;
    sku: string;
    brand: string;
    name: string;
    description?: string | null;
    publicPrice?: number | null;
    price?: number | null;
    costPrice: number;
    unitPrice?: number | null;
    allowsManualValueInSale: boolean;
    noDeliverySurcharge?: number | null;
}

export interface ProductResponse {
    id: string;
    code: string;
    sku: string;
    brand: string;
    name: string;
    description?: string | null;
    price: number;
    publicPrice?: number | null;
    costPrice?: number | null;
    unitPrice?: number | null;
    allowsManualValueInSale: boolean;
    noDeliverySurcharge?: number | null;
    totalOnHandQuantity: number;
    totalReservedQuantity: number;
    totalAvailableQuantity: number;
    createdAt: string;
    updatedAt?: string | null;
}

export interface PagedProductsResponse {
    items: ProductResponse[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface UpdateProductRequest {
    code: string;
    sku: string;
    brand: string;
    name: string;
    description?: string | null;
    publicPrice?: number | null;
    price?: number | null;
    costPrice: number;
    unitPrice?: number | null;
    allowsManualValueInSale: boolean;
    noDeliverySurcharge?: number | null;
}

export function productPublicPrice(product: Pick<ProductResponse, 'publicPrice' | 'price'>): number {
    return Number(product.publicPrice ?? product.price ?? 0);
}

export function productAllowsManualSaleValue(product: Pick<ProductResponse, 'allowsManualValueInSale'>): boolean {
    return product.allowsManualValueInSale;
}
