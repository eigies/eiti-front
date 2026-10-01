import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BranchResponse, CreateBranchRequest, SetBranchPointOfSaleRequest, TransferTargetResponse } from '../models/branch.models';

@Injectable({ providedIn: 'root' })
export class BranchService {
    private readonly base = `${environment.apiUrl}/branches`;

    constructor(private http: HttpClient) { }

    listBranches(): Observable<BranchResponse[]> {
        return this.http.get<BranchResponse[]>(this.base);
    }

    listTransferTargets(): Observable<TransferTargetResponse[]> {
        return this.http.get<TransferTargetResponse[]>(`${this.base}/transfer-targets`);
    }

    createBranch(request: CreateBranchRequest): Observable<BranchResponse> {
        return this.http.post<BranchResponse>(this.base, request);
    }

    updateBranch(id: string, request: CreateBranchRequest): Observable<BranchResponse> {
        return this.http.put<BranchResponse>(`${this.base}/${id}`, request);
    }

    /** Va aparte de editar la sucursal: un "editar" que no lo mande no lo borra. */
    setFiscalPointOfSale(id: string, request: SetBranchPointOfSaleRequest): Observable<BranchResponse> {
        return this.http.put<BranchResponse>(`${this.base}/${id}/fiscal-point-of-sale`, request);
    }

    deleteBranch(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
