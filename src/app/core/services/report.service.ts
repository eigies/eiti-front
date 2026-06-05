import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    CashMovementsReportResponse,
    CustomerDebtorsResponse,
    SalesReportFilters,
    SalesReportResponse,
    StockMatrixResponse
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
        return this.http.get<SalesReportResponse>(`${this.base}/sales?${params.toString()}`);
    }

    customerDebtors(): Observable<CustomerDebtorsResponse> {
        return this.http.get<CustomerDebtorsResponse>(`${this.base}/customers/debtors`);
    }

    cashMovements(dateFrom: string, dateTo: string): Observable<CashMovementsReportResponse> {
        const params = new URLSearchParams({ dateFrom, dateTo });
        return this.http.get<CashMovementsReportResponse>(`${this.base}/cash/movements?${params.toString()}`);
    }

    stockMatrix(): Observable<StockMatrixResponse> {
        return this.http.get<StockMatrixResponse>(`${this.base}/stock-matrix`);
    }
}
