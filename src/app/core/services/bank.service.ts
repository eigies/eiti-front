import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BankResponse } from '../models/bank.models';

@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly base = `${environment.apiUrl}/banks`;

  constructor(private readonly http: HttpClient) {}

  listBanks(activeOnly = false): Observable<BankResponse[]> {
    return this.http.get<BankResponse[]>(this.base, { params: { activeOnly: String(activeOnly) } });
  }

  createBank(name: string): Observable<BankResponse> {
    return this.http.post<BankResponse>(this.base, { name });
  }

  updateBank(id: number, data: { name: string; active: boolean }): Observable<BankResponse> {
    return this.http.put<BankResponse>(`${this.base}/${id}`, data);
  }

  upsertInstallmentPlan(bankId: number, plan: { cuotas: number; surchargePct: number; active: boolean }): Observable<BankResponse> {
    return this.http.put<BankResponse>(`${this.base}/${bankId}/plans`, plan);
  }
}
