import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddPurchasePaymentRequest,
  AddPurchasePaymentResult,
  CreatePurchaseRequest,
  PurchaseDetailResponse,
  PurchaseListResponse
} from '../models/purchase.models';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly base = `${environment.apiUrl}/purchases`;

  constructor(private readonly http: HttpClient) {}

  listPurchases(filters: {
    supplierId?: string;
    status?: number;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PurchaseListResponse> {
    const params = new URLSearchParams();
    if (filters.supplierId) params.set('supplierId', filters.supplierId);
    if (filters.status !== undefined && filters.status !== null) params.set('status', String(filters.status));
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
    const query = params.toString();
    const url = query ? `${this.base}?${query}` : this.base;
    return this.http.get<PurchaseListResponse>(url);
  }

  createPurchase(req: CreatePurchaseRequest): Observable<PurchaseDetailResponse> {
    return this.http.post<PurchaseDetailResponse>(this.base, req);
  }

  getPurchaseById(id: string): Observable<PurchaseDetailResponse> {
    return this.http.get<PurchaseDetailResponse>(`${this.base}/${id}`);
  }

  cancelPurchase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addPayment(purchaseId: string, req: AddPurchasePaymentRequest): Observable<AddPurchasePaymentResult> {
    return this.http.post<AddPurchasePaymentResult>(`${this.base}/${purchaseId}/payments`, req);
  }

  cancelPayment(purchaseId: string, paymentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${purchaseId}/payments/${paymentId}`);
  }
}
