import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddSupplierPaymentRequest,
  AddSupplierPaymentResult,
  SupplierAccount,
  SupplierAccountListItem
} from '../models/supplier-account.models';

@Injectable({ providedIn: 'root' })
export class SupplierAccountService {
  private readonly base = `${environment.apiUrl}/suppliers`;

  constructor(private readonly http: HttpClient) {}

  listAccounts(search?: string): Observable<SupplierAccountListItem[]> {
    const url = search ? `${this.base}/accounts?search=${encodeURIComponent(search)}` : `${this.base}/accounts`;
    return this.http.get<SupplierAccountListItem[]>(url);
  }

  getAccount(supplierId: string): Observable<SupplierAccount> {
    return this.http.get<SupplierAccount>(`${this.base}/${supplierId}/account`);
  }

  addPayment(supplierId: string, req: AddSupplierPaymentRequest): Observable<AddSupplierPaymentResult> {
    return this.http.post<AddSupplierPaymentResult>(`${this.base}/${supplierId}/payments`, req);
  }

  cancelPayment(supplierId: string, paymentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${supplierId}/payments/${paymentId}`);
  }
}
