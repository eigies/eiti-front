import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BonusConceptResponse, CreateBonusConceptRequest, UpdateBonusConceptRequest } from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class PayrollBonusConceptService {
  private readonly base = `${environment.apiUrl}/payroll-bonus-concepts`;

  constructor(private readonly http: HttpClient) {}

  list(activeOnly: boolean): Observable<BonusConceptResponse[]> {
    return this.http.get<BonusConceptResponse[]>(this.base, { params: { activeOnly: String(activeOnly) } });
  }

  create(req: CreateBonusConceptRequest): Observable<BonusConceptResponse> {
    return this.http.post<BonusConceptResponse>(this.base, req);
  }

  update(id: string, req: UpdateBonusConceptRequest): Observable<BonusConceptResponse> {
    return this.http.put<BonusConceptResponse>(`${this.base}/${id}`, req);
  }

  setActive(id: string, isActive: boolean): Observable<BonusConceptResponse> {
    return this.http.put<BonusConceptResponse>(`${this.base}/${id}/active`, { isActive });
  }
}
