import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddSupplierPaymentRequest,
  AddSupplierPaymentResult,
  SupplierAccount,
  SupplierAccountListItem,
  SupplierPaymentOrderRequest,
  SupplierPaymentOrderResult
} from '../models/supplier-account.models';
import { AccountLedger, LedgerQuery } from '../models/account-ledger.models';
import { ledgerParams } from './ledger-params.util';
import { CreateCreditNoteRequest, CreateCreditNoteResult } from '../models/credit-note.models';

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

  getLedger(supplierId: string, query: LedgerQuery): Observable<AccountLedger> {
    return this.http.get<AccountLedger>(`${this.base}/${supplierId}/ledger`, { params: ledgerParams(query) });
  }

  createPaymentOrder(supplierId: string, req: SupplierPaymentOrderRequest): Observable<SupplierPaymentOrderResult> {
    return this.http.post<SupplierPaymentOrderResult>(`${this.base}/${supplierId}/payment-orders`, req);
  }

  cancelPaymentOrder(supplierId: string, paymentOrderId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${supplierId}/payment-orders/${paymentOrderId}`);
  }

  addPayment(supplierId: string, req: AddSupplierPaymentRequest): Observable<AddSupplierPaymentResult> {
    return this.http.post<AddSupplierPaymentResult>(`${this.base}/${supplierId}/payments`, req);
  }

  cancelPayment(supplierId: string, paymentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${supplierId}/payments/${paymentId}`);
  }

  createCreditNote(supplierId: string, req: CreateCreditNoteRequest): Observable<CreateCreditNoteResult> {
    return this.http.post<CreateCreditNoteResult>(`${this.base}/${supplierId}/credit-notes`, req);
  }

  cancelCreditNote(supplierId: string, creditNoteId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${supplierId}/credit-notes/${creditNoteId}`);
  }
}
