import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreatePayrollBonusRequest, PayrollBonusResponse } from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class PayrollBonusService {
  private readonly base = `${environment.apiUrl}/payroll-bonuses`;

  constructor(private readonly http: HttpClient) {}

  list(employeeId?: string, status?: number): Observable<PayrollBonusResponse[]> {
    let params = new HttpParams();
    if (employeeId) {
      params = params.set('employeeId', employeeId);
    }
    if (status) {
      params = params.set('status', String(status));
    }
    return this.http.get<PayrollBonusResponse[]>(this.base, { params });
  }

  create(req: CreatePayrollBonusRequest): Observable<PayrollBonusResponse> {
    return this.http.post<PayrollBonusResponse>(this.base, req);
  }

  cancel(id: string): Observable<PayrollBonusResponse> {
    return this.http.post<PayrollBonusResponse>(`${this.base}/${id}/cancel`, {});
  }
}
