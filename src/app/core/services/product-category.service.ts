import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProductCategoryRequest, ProductCategoryResponse, UpdateProductCategoryRequest } from '../models/product-category.models';

@Injectable({ providedIn: 'root' })
export class ProductCategoryService {
  private readonly base = `${environment.apiUrl}/product-categories`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<ProductCategoryResponse[]> {
    return this.http.get<ProductCategoryResponse[]>(this.base);
  }

  create(req: CreateProductCategoryRequest): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(this.base, req);
  }

  update(id: string, req: UpdateProductCategoryRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
