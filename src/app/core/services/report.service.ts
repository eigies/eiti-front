import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    CashMovementsReportResponse,
    CustomerDebtorsResponse,
    DailySalesControlResponse,
    PaymentMethodsReportResponse,
    SalesReportFilters,
    SalesReportResponse,
    StockMatrixResponse,
    StockMovementsReportResponse,
    WholesaleByCustomerFilters,
    WholesaleByCustomerResponse
} from '../models/report.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
    private readonly base = `${environment.apiUrl}/reports`;

    constructor(private readonly http: HttpClient) {}

    salesReport(filters: SalesReportFilters): Observable<SalesReportResponse> {
        const params = new URLSearchParams();
        params.set('dateFrom', filters.dateFrom);
        params.set('dateTo', filters.dateTo);
        params.set('groupBy', filters.groupBy);
        if (filters.customerId) params.set('customerId', filters.customerId);
        if (filters.installerId) params.set('installerId', filters.installerId);
        if (filters.vehicleId) params.set('vehicleId', filters.vehicleId);
        if (filters.channel != null) params.set('channel', String(filters.channel));
        if (filters.deliveryMode && filters.deliveryMode !== 'all') params.set('deliveryMode', filters.deliveryMode);
        if (filters.categoryId) params.set('categoryId', filters.categoryId);
        if (filters.saleType && filters.saleType !== 'all') params.set('saleType', filters.saleType);
        if (filters.branchId) params.set('branchId', filters.branchId);
        return this.http.get<SalesReportResponse>(`${this.base}/sales?${params.toString()}`);
    }

    wholesaleByCustomer(filters: WholesaleByCustomerFilters): Observable<WholesaleByCustomerResponse> {
        const params = new URLSearchParams();
        params.set('dateFrom', filters.dateFrom);
        params.set('dateTo', filters.dateTo);
        if (filters.saleType) params.set('saleType', filters.saleType);
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.customerId) params.set('customerId', filters.customerId);
        return this.http.get<WholesaleByCustomerResponse>(`${this.base}/sales/wholesale-by-customer?${params.toString()}`);
    }

    customerDebtors(): Observable<CustomerDebtorsResponse> {
        return this.http.get<CustomerDebtorsResponse>(`${this.base}/customers/debtors`);
    }

    cashMovements(dateFrom: string, dateTo: string): Observable<CashMovementsReportResponse> {
        const params = new URLSearchParams({ dateFrom, dateTo });
        return this.http.get<CashMovementsReportResponse>(`${this.base}/cash/movements?${params.toString()}`);
    }

    paymentMethods(dateFrom: string, dateTo: string, branchId?: string, saleType?: string): Observable<PaymentMethodsReportResponse> {
        const params = new URLSearchParams({ dateFrom, dateTo });
        if (branchId) params.set('branchId', branchId);
        if (saleType && saleType !== 'all') params.set('saleType', saleType);
        return this.http.get<PaymentMethodsReportResponse>(`${this.base}/payments?${params.toString()}`);
    }

    stockMatrix(): Observable<StockMatrixResponse> {
        return this.http.get<StockMatrixResponse>(`${this.base}/stock-matrix`);
    }

    stockMovements(dateFrom: string, dateTo: string, productId?: string, branchId?: string, type?: number, page = 1, pageSize = 50): Observable<StockMovementsReportResponse> {
        const params = new URLSearchParams({ dateFrom, dateTo });
        if (productId) params.set('productId', productId);
        if (branchId) params.set('branchId', branchId);
        if (type != null) params.set('type', String(type));
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        return this.http.get<StockMovementsReportResponse>(`${this.base}/stock-movements?${params.toString()}`);
    }

    dailySalesControl(dateFrom: string, dateTo: string, status = 0): Observable<DailySalesControlResponse> {
        const params = new URLSearchParams({ dateFrom, dateTo, status: String(status) });
        return this.http.get<DailySalesControlResponse>(`${this.base}/sales/daily-control?${params.toString()}`);
    }
}
