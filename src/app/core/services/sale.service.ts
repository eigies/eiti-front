import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSaleRequest, SaleResponse, SendSaleWhatsAppResponse } from '../models/sale.models';
import { CreateSaleTransportRequest, SaleTransportResponse } from '../models/transport.models';

@Injectable({ providedIn: 'root' })
export class SaleService {
    private readonly base = `${environment.apiUrl}/sales`;

    constructor(private http: HttpClient) { }

    createSale(request: CreateSaleRequest): Observable<SaleResponse> {
        return this.http.post<SaleResponse>(this.base, request);
    }

    listSales(filters: {
        dateFrom?: string;
        dateTo?: string;
        idSaleStatus?: number | null;
    }): Observable<SaleResponse[]> {
        const params = new URLSearchParams();

        if (filters.dateFrom) {
            params.set('dateFrom', filters.dateFrom);
        }

        if (filters.dateTo) {
            params.set('dateTo', filters.dateTo);
        }

        if (filters.idSaleStatus) {
            params.set('idSaleStatus', String(filters.idSaleStatus));
        }

        const query = params.toString();
        const url = query ? `${this.base}?${query}` : this.base;

        return this.http.get<SaleResponse[]>(url);
    }

    updateSale(id: string, request: CreateSaleRequest): Observable<SaleResponse> {
        return this.http.put<SaleResponse>(`${this.base}/${id}`, request);
    }

    sendSaleWhatsApp(id: string): Observable<SendSaleWhatsAppResponse> {
        return this.http.post<SendSaleWhatsAppResponse>(`${this.base}/${id}/send-whatsapp`, {});
    }

    cancelSale(id: string): Observable<void> {
        return this.http.post<void>(`${this.base}/${id}/cancel`, {});
    }

    deleteSale(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }

    getTransport(id: string): Observable<SaleTransportResponse> {
        return this.http.get<SaleTransportResponse>(`${this.base}/${id}/transport`);
    }

    createTransport(id: string, request: CreateSaleTransportRequest): Observable<SaleTransportResponse> {
        return this.http.post<SaleTransportResponse>(`${this.base}/${id}/transport`, request);
    }

    updateTransport(id: string, request: CreateSaleTransportRequest): Observable<SaleTransportResponse> {
        return this.http.put<SaleTransportResponse>(`${this.base}/${id}/transport`, request);
    }

    updateTransportStatus(id: string, status: number): Observable<SaleTransportResponse> {
        return this.http.put<SaleTransportResponse>(`${this.base}/${id}/transport/status`, { status });
    }

    deleteTransport(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}/transport`);
    }
}
