import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    CreateFiscalPointOfSaleRequest,
    FiscalIssuerResponse,
    FiscalPointOfSaleResponse,
    FiscalSettingsResponse,
    UpdateFiscalIssuerRequest
} from '../models/fiscal-settings.models';

@Injectable({ providedIn: 'root' })
export class FiscalSettingsService {
    private readonly base = `${environment.apiUrl}/fiscal-settings`;

    constructor(private readonly http: HttpClient) { }

    get(): Observable<FiscalSettingsResponse> {
        return this.http.get<FiscalSettingsResponse>(this.base);
    }

    updateIssuer(request: UpdateFiscalIssuerRequest): Observable<FiscalIssuerResponse> {
        return this.http.put<FiscalIssuerResponse>(`${this.base}/issuer`, request);
    }

    createPointOfSale(request: CreateFiscalPointOfSaleRequest): Observable<FiscalPointOfSaleResponse> {
        return this.http.post<FiscalPointOfSaleResponse>(`${this.base}/points-of-sale`, request);
    }

    /** branchId null deja el punto de venta libre. */
    assignPointOfSale(id: string, branchId: string | null): Observable<FiscalPointOfSaleResponse> {
        return this.http.put<FiscalPointOfSaleResponse>(`${this.base}/points-of-sale/${id}/branch`, { branchId });
    }

    deletePointOfSale(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/points-of-sale/${id}`);
    }
}
