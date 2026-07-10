import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreatePayrollAdvanceRequest, PayrollAdvanceResponse } from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class PayrollAdvanceService {
  private readonly base = `${environment.apiUrl}/payroll-advances`;

  constructor(private readonly http: HttpClient) {}

  list(employeeId?: string, status?: number): Observable<PayrollAdvanceResponse[]> {
    let params = new HttpParams();
    if (employeeId) {
      params = params.set('employeeId', employeeId);
    }
    if (status) {
      params = params.set('status', String(status));
    }
    return this.http.get<PayrollAdvanceResponse[]>(this.base, { params });
  }

  create(req: CreatePayrollAdvanceRequest): Observable<PayrollAdvanceResponse> {
    return this.http.post<PayrollAdvanceResponse>(this.base, req);
  }

  cancel(id: string): Observable<PayrollAdvanceResponse> {
    return this.http.post<PayrollAdvanceResponse>(`${this.base}/${id}/cancel`, {});
  }
}
