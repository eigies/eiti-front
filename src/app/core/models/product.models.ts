export interface CreateProductRequest {
    code: string;
    sku: string;
    brand: string;
    name: string;
    description?: string | null;
    price: number;
}

export interface ProductResponse {
    id: string;
    code: string;
    sku: string;
    brand: string;
    name: string;
    description?: string | null;
    price: number;
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
    price: number;
}
