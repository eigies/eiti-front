import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateDeductionConceptRequest, DeductionConceptResponse, UpdateDeductionConceptRequest } from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class PayrollDeductionConceptService {
  private readonly base = `${environment.apiUrl}/payroll-deduction-concepts`;

  constructor(private readonly http: HttpClient) {}

  list(activeOnly: boolean): Observable<DeductionConceptResponse[]> {
    return this.http.get<DeductionConceptResponse[]>(this.base, { params: { activeOnly: String(activeOnly) } });
  }

  create(req: CreateDeductionConceptRequest): Observable<DeductionConceptResponse> {
    return this.http.post<DeductionConceptResponse>(this.base, req);
  }

  update(id: string, req: UpdateDeductionConceptRequest): Observable<DeductionConceptResponse> {
    return this.http.put<DeductionConceptResponse>(`${this.base}/${id}`, req);
  }

  setActive(id: string, isActive: boolean): Observable<DeductionConceptResponse> {
    return this.http.put<DeductionConceptResponse>(`${this.base}/${id}/active`, { isActive });
  }
}
