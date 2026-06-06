import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdjustStockRequest, BranchProductStockResponse, ProductReservationsResponse, StockMovementResponse, TransferDetailResponse, TransferStockRequest, TransferStockResponse } from '../models/stock.models';

@Injectable({ providedIn: 'root' })
export class StockService {
    private readonly base = `${environment.apiUrl}/stock`;

    constructor(private http: HttpClient) { }

    listBranchStock(branchId: string): Observable<BranchProductStockResponse[]> {
        return this.http.get<BranchProductStockResponse[]>(`${this.base}?branchId=${branchId}`);
    }

    getBranchProductStock(branchId: string, productId: string): Observable<BranchProductStockResponse> {
        return this.http.get<BranchProductStockResponse>(`${this.base}/product/${productId}?branchId=${branchId}`);
    }

    listStockMovements(branchId: string, productId: string): Observable<StockMovementResponse[]> {
        return this.http.get<StockMovementResponse[]>(`${this.base}/movements?branchId=${branchId}&productId=${productId}`);
    }

    adjustStock(request: AdjustStockRequest): Observable<BranchProductStockResponse> {
        return this.http.post<BranchProductStockResponse>(`${this.base}/adjust`, request);
    }

    transferStock(request: TransferStockRequest): Observable<TransferStockResponse> {
        return this.http.post<TransferStockResponse>(`${this.base}/transfer`, request);
    }

    getTransferDetail(referenceId: string): Observable<TransferDetailResponse> {
        return this.http.get<TransferDetailResponse>(`${this.base}/transfer/${referenceId}`);
    }

    getProductReservations(productId: string, branchId?: string): Observable<ProductReservationsResponse> {
        const params = branchId
            ? `?productId=${productId}&branchId=${branchId}`
            : `?productId=${productId}`;
        return this.http.get<ProductReservationsResponse>(`${this.base}/reservations${params}`);
    }
}
