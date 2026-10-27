import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CcPaymentResponse, CcSaleListItem, CreateCcSaleRequest, CreateCcSaleResponse, CreateSaleRequest, CreateSaleResponse, InvoiceLetter, InvoiceSaleResponse, RegularizeSaleCreditNoteResponse, RetrySaleCreditNoteResponse, SaleByIdResponse, SaleFiscalReceiversResponse, SaleInvoicePrintResponse, SaleResponse, SendSaleWhatsAppResponse } from '../models/sale.models';
import { CreateSaleTransportRequest, SaleTransportResponse } from '../models/transport.models';

@Injectable({ providedIn: 'root' })
export class SaleService {
    private readonly base = `${environment.apiUrl}/sales`;

    constructor(private http: HttpClient) { }

    createSale(request: CreateSaleRequest): Observable<CreateSaleResponse> {
        return this.http.post<CreateSaleResponse>(this.base, request);
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
    // confirmInvoiceReceiver: el usuario vio que la factura salio a otro receptor que el de la ficha y confirmo
    // que la NC vaya al de la factura (el back responde Sales.Cancel.InvoiceReceiverChanged hasta tenerlo).
    cancelSale(id: string, refundMode?: number, confirmInvoiceReceiver = false): Observable<void> {
        const params = new URLSearchParams();
        if (refundMode) params.set('refundMode', String(refundMode));
        if (confirmInvoiceReceiver) params.set('confirmInvoiceReceiver', 'true');
        const query = params.toString();
        return this.http.post<void>(`${this.base}/${id}/cancel${query ? `?${query}` : ''}`, {});
    }

    /** A quien se emitieron la factura, su NC y su ND (segun el servicio fiscal) contra la ficha del cliente. */
    getFiscalReceivers(id: string): Observable<SaleFiscalReceiversResponse> {
        return this.http.get<SaleFiscalReceiversResponse>(`${this.base}/${id}/fiscal-receivers`);
    }

    /** Vuelve a pedir la NC de una venta anulada cuya factura sigue vigente. */
    retryCreditNote(id: string, confirmInvoiceReceiver = false): Observable<RetrySaleCreditNoteResponse> {
        const query = confirmInvoiceReceiver ? '?confirmInvoiceReceiver=true' : '';
        return this.http.post<RetrySaleCreditNoteResponse>(`${this.base}/${id}/credit-note${query}`, {});
    }

    /** Regulariza una NC emitida a otro receptor que el de su factura (ND + NC nueva). Ya confirmado por el usuario. */
    regularizeCreditNote(id: string): Observable<RegularizeSaleCreditNoteResponse> {
        return this.http.post<RegularizeSaleCreditNoteResponse>(`${this.base}/${id}/credit-note/regularize?confirm=true`, {});
    }

    deleteSale(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }

    /** Sin letra la decide el cliente; con letra, el back la valida contra el cliente antes de emitir. */
    invoiceSale(id: string, invoiceLetter?: InvoiceLetter | null): Observable<InvoiceSaleResponse> {
        return this.http.post<InvoiceSaleResponse>(`${this.base}/${id}/invoice`, invoiceLetter ? { invoiceLetter } : {});
    }

    /**
     * Datos para armar el PDF de la factura con el diseno de EITI (InvoicePdfService).
     * Salen por la API de EITI, no por el servicio fiscal: ese exige la API key de servicio.
     */
    getInvoicePrint(id: string): Observable<SaleInvoicePrintResponse> {
        return this.http.get<SaleInvoicePrintResponse>(`${this.base}/${id}/invoice/print`);
    }

    /** Idem para la nota de credito que anulo la factura. */
    getCreditNotePrint(id: string): Observable<SaleInvoicePrintResponse> {
        return this.http.get<SaleInvoicePrintResponse>(`${this.base}/${id}/credit-note/print`);
    }

    /** Idem para la nota de debito que neutralizo una NC mal emitida. */
    getDebitNotePrint(id: string): Observable<SaleInvoicePrintResponse> {
        return this.http.get<SaleInvoicePrintResponse>(`${this.base}/${id}/debit-note/print`);
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
