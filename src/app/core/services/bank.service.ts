import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BankResponse, BankUpsertRequest, BankUsage } from '../models/bank.models';

@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly base = `${environment.apiUrl}/banks`;

  constructor(private readonly http: HttpClient) {}

  listBanks(activeOnly = false, usage: BankUsage = 'all'): Observable<BankResponse[]> {
    return this.http.get<BankResponse[]>(this.base, {
      params: {
        activeOnly: String(activeOnly),
        usage
      }
    });
  }

  createBank(data: BankUpsertRequest): Observable<BankResponse> {
    return this.http.post<BankResponse>(this.base, data);
  }

  updateBank(id: number, data: BankUpsertRequest & { active: boolean }): Observable<BankResponse> {
    return this.http.put<BankResponse>(`${this.base}/${id}`, data);
  }

  upsertInstallmentPlan(bankId: number, plan: { cuotas: number; surchargePct: number; active: boolean }): Observable<BankResponse> {
    return this.http.put<BankResponse>(`${this.base}/${bankId}/plans`, plan);
  }
}
