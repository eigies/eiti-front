import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardSaleResponse, DashboardSummaryResponse } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getSummary(
    dateFrom: string,
    dateTo: string,
    branchId?: string | null,
    categoryIds?: readonly string[] | null
  ): Observable<DashboardSummaryResponse> {
    const params = new URLSearchParams();
    params.set('dateFrom', dateFrom);
    params.set('dateTo', dateTo);
    if (branchId) {
      params.set('branchId', branchId);
    }
    // Repetido, no separado por comas: es como ASP.NET bindea un Guid[] desde el query string.
    for (const categoryId of categoryIds ?? []) {
      params.append('categoryIds', categoryId);
    }

    return this.http.get<DashboardSummaryResponse>(
      `${this.base}/summary?${params.toString()}`
    );
  }

  listSales(
    dateFrom: string,
    dateTo: string,
    branchId?: string | null
  ): Observable<DashboardSaleResponse[]> {
    const params = new URLSearchParams();
    params.set('dateFrom', dateFrom);
    params.set('dateTo', dateTo);
    if (branchId) {
      params.set('branchId', branchId);
    }

    return this.http.get<DashboardSaleResponse[]>(
      `${this.base}/sales?${params.toString()}`
    );
  }
}
