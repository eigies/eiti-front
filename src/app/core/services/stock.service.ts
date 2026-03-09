import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdjustStockRequest, BranchProductStockResponse, StockMovementResponse } from '../models/stock.models';

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
}
