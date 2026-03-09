import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyResponse, UpdateCompanyRequest } from '../models/company.models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
    private readonly base = `${environment.apiUrl}/companies`;

    constructor(private http: HttpClient) { }

    getCurrentCompany(): Observable<CompanyResponse> {
        return this.http.get<CompanyResponse>(`${this.base}/current`);
    }

    updateCurrentCompany(request: UpdateCompanyRequest): Observable<CompanyResponse> {
        return this.http.put<CompanyResponse>(`${this.base}/current`, request);
    }
}
