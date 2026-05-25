import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSupplierRequest, SupplierListItem, UpdateSupplierRequest } from '../models/supplier.models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly base = `${environment.apiUrl}/suppliers`;

  constructor(private readonly http: HttpClient) {}

  listSuppliers(search?: string, activeOnly = true): Observable<SupplierListItem[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('activeOnly', String(activeOnly));
    const query = params.toString();
    const url = query ? `${this.base}?${query}` : this.base;
    return this.http.get<SupplierListItem[]>(url);
  }

  createSupplier(req: CreateSupplierRequest): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(this.base, req);
  }

  updateSupplier(id: string, req: UpdateSupplierRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }

  deactivateSupplier(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
