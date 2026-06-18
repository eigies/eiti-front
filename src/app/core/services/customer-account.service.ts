import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AddCustomerPaymentRequest,
  AddCustomerPaymentResult,
  CustomerAccount,
  CustomerAccountListItem,
  CustomerPaymentLink
} from '../models/customer-account.models';

interface CustomerAccountListResponse {
  items: CustomerAccountListItem[];
}

@Injectable({ providedIn: 'root' })
export class CustomerAccountService {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listCustomerAccounts(): Observable<CustomerAccountListItem[]> {
    return this.http
      .get<CustomerAccountListResponse>(`${this.base}/customer-accounts`)
      .pipe(map(resp => resp?.items ?? []));
  }

  getAccount(customerId: string): Observable<CustomerAccount> {
    return this.http.get<CustomerAccount>(`${this.base}/customers/${customerId}/account`);
  }

  addPayment(customerId: string, req: AddCustomerPaymentRequest): Observable<AddCustomerPaymentResult> {
    return this.http.post<AddCustomerPaymentResult>(`${this.base}/customers/${customerId}/payments`, req);
  }

  cancelPayment(customerId: string, paymentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/customers/${customerId}/payments/${paymentId}`);
  }

  getPaymentLink(paymentId: string): Observable<CustomerPaymentLink> {
    return this.http.get<CustomerPaymentLink>(`${this.base}/customers/payments/${paymentId}/link`);
  }
}
