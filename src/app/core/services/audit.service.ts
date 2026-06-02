import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLogFilters, AuditLogPagedResponse } from '../models/audit.models';

@Injectable({ providedIn: 'root' })
export class AuditService {
    private readonly base = `${environment.apiUrl}/reports`;

    constructor(private readonly http: HttpClient) {}

    listAuditLog(filters: AuditLogFilters): Observable<AuditLogPagedResponse> {
        const params = new URLSearchParams();
        params.set('dateFrom', filters.dateFrom);
        params.set('dateTo', filters.dateTo);

        if (filters.userId) {
            params.set('userId', filters.userId);
        }

        params.set('page', String(filters.page ?? 1));
        params.set('pageSize', String(filters.pageSize ?? 25));

        return this.http.get<AuditLogPagedResponse>(`${this.base}/audit?${params.toString()}`);
    }
}
