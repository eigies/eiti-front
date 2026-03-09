import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CashDrawerResponse, CashSessionResponse, CashSessionSummaryResponse } from '../models/cash.models';

@Injectable({ providedIn: 'root' })
export class CashService {
    private readonly drawersBase = `${environment.apiUrl}/cashdrawers`;
    private readonly sessionsBase = `${environment.apiUrl}/cashsessions`;

    constructor(private http: HttpClient) { }

    listCashDrawers(branchId: string): Observable<CashDrawerResponse[]> {
        return this.http.get<CashDrawerResponse[]>(`${this.drawersBase}?branchId=${branchId}`);
    }

    createCashDrawer(branchId: string, name: string): Observable<CashDrawerResponse> {
        return this.http.post<CashDrawerResponse>(this.drawersBase, { branchId, name });
    }

    openSession(cashDrawerId: string, openingAmount: number, notes?: string): Observable<CashSessionResponse> {
        return this.http.post<CashSessionResponse>(`${this.sessionsBase}/open`, { cashDrawerId, openingAmount, notes });
    }

    closeSession(id: string, actualClosingAmount: number, notes?: string): Observable<CashSessionResponse> {
        return this.http.post<CashSessionResponse>(`${this.sessionsBase}/${id}/close`, { actualClosingAmount, notes });
    }

    withdraw(id: string, amount: number, description: string): Observable<CashSessionResponse> {
        return this.http.post<CashSessionResponse>(`${this.sessionsBase}/${id}/withdrawals`, { amount, description });
    }

    getCurrentSession(cashDrawerId: string): Observable<CashSessionResponse> {
        return this.http.get<CashSessionResponse>(`${this.sessionsBase}/current?cashDrawerId=${cashDrawerId}`);
    }

    listHistory(cashDrawerId: string, from?: string, to?: string): Observable<CashSessionResponse[]> {
        const params = new URLSearchParams({ cashDrawerId });

        if (from) {
            params.set('from', from);
        }

        if (to) {
            params.set('to', to);
        }

        return this.http.get<CashSessionResponse[]>(`${this.sessionsBase}/history?${params.toString()}`);
    }

    getSummary(id: string): Observable<CashSessionSummaryResponse> {
        return this.http.get<CashSessionSummaryResponse>(`${this.sessionsBase}/${id}/summary`);
    }
}
