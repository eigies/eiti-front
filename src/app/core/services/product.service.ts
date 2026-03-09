import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProductRequest, PagedProductsResponse, ProductResponse, UpdateProductRequest } from '../models/product.models';

@Injectable({ providedIn: 'root' })
export class ProductService {
    private readonly base = `${environment.apiUrl}/products`;

    constructor(private http: HttpClient) { }

    listProducts(): Observable<ProductResponse[]> {
        return this.http.get<ProductResponse[]>(this.base);
    }

    listProductsPaged(page: number, pageSize: number): Observable<PagedProductsResponse> {
        return this.http.get<PagedProductsResponse>(`${this.base}/paged?page=${page}&pageSize=${pageSize}`);
    }

    createProduct(request: CreateProductRequest): Observable<ProductResponse> {
        return this.http.post<ProductResponse>(this.base, request);
    }

    updateProduct(id: string, request: UpdateProductRequest): Observable<ProductResponse> {
        return this.http.put<ProductResponse>(`${this.base}/${id}`, request);
    }

    deleteProduct(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
