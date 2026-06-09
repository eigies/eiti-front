export interface ProductCategoryResponse {
    id: string;
    name: string;
}

export interface CreateProductCategoryRequest {
    name: string;
}

export interface UpdateProductCategoryRequest {
    id: string;
    name: string;
}
