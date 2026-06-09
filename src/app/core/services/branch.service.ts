import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BranchResponse, CreateBranchRequest, TransferTargetResponse } from '../models/branch.models';

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

    deleteBranch(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
