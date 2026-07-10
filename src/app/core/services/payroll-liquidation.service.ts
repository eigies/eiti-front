import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GeneratePayrollPeriodRequest,
  GeneratePayrollPeriodResponse,
  ListLiquidationsResponse,
  PayLiquidationRequest,
  PayrollLiquidationResponse
} from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class PayrollLiquidationService {
  private readonly base = `${environment.apiUrl}/payroll-liquidations`;

  constructor(private readonly http: HttpClient) {}

  list(filters: { employeeId?: string; periodLabel?: string; status?: number; page: number; pageSize: number }): Observable<ListLiquidationsResponse> {
    let params = new HttpParams()
      .set('page', String(filters.page))
      .set('pageSize', String(filters.pageSize));
    if (filters.employeeId) {
      params = params.set('employeeId', filters.employeeId);
    }
    if (filters.periodLabel) {
      params = params.set('periodLabel', filters.periodLabel);
    }
    if (filters.status) {
      params = params.set('status', String(filters.status));
    }
    return this.http.get<ListLiquidationsResponse>(this.base, { params });
  }

  getById(id: string): Observable<PayrollLiquidationResponse> {
    return this.http.get<PayrollLiquidationResponse>(`${this.base}/${id}`);
  }

  generate(req: GeneratePayrollPeriodRequest): Observable<GeneratePayrollPeriodResponse> {
    return this.http.post<GeneratePayrollPeriodResponse>(`${this.base}/generate`, req);
  }

  pay(id: string, req: PayLiquidationRequest): Observable<PayrollLiquidationResponse> {
    return this.http.post<PayrollLiquidationResponse>(`${this.base}/${id}/pay`, req);
  }

  cancel(id: string): Observable<PayrollLiquidationResponse> {
    return this.http.post<PayrollLiquidationResponse>(`${this.base}/${id}/cancel`, {});
  }
}
