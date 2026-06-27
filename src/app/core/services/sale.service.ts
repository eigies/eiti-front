import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CcPaymentResponse, CcSaleListItem, CreateCcSaleRequest, CreateCcSaleResponse, CreateSaleRequest, SaleByIdResponse, SaleResponse, SendSaleWhatsAppResponse } from '../models/sale.models';
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
        includeCuentaCorriente?: boolean;
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

        if (filters.includeCuentaCorriente === true) {
            params.set('includeCuentaCorriente', 'true');
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

    // refundMode (solo ventas CC con cobros): 1 = saldo a favor, 2 = anular pagos (cuentas a 0).
    cancelSale(id: string, refundMode?: number): Observable<void> {
        const query = refundMode ? `?refundMode=${refundMode}` : '';
        return this.http.post<void>(`${this.base}/${id}/cancel${query}`, {});
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

    searchDeliveryAddresses(query: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.base}/delivery-addresses?query=${encodeURIComponent(query)}`);
    }

    getSaleById(id: string): Observable<SaleByIdResponse> {
        return this.http.get<SaleByIdResponse>(`${this.base}/${id}`);
    }

    createCcSale(request: CreateCcSaleRequest): Observable<CreateCcSaleResponse> {
        return this.http.post<CreateCcSaleResponse>(`${this.base}/cc`, request);
    }

    listCcPayments(saleId: string): Observable<CcPaymentResponse[]> {
        return this.http.get<CcPaymentResponse[]>(`${this.base}/${saleId}/cc-payments`);
    }

    listCcSales(customerId?: string): Observable<CcSaleListItem[]> {
        const params = customerId ? `?customerId=${customerId}` : '';
        return this.http.get<CcSaleListItem[]>(`${this.base}/cc${params}`);
    }
}
