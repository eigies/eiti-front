import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateCustomerRequest, CustomerResponse, CustomerSearchItem, UpdateCustomerRequest } from '../models/customer.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
    private readonly base = `${environment.apiUrl}/customers`;

    constructor(private http: HttpClient) { }

    createCustomer(request: CreateCustomerRequest): Observable<CustomerResponse> {
        return this.http.post<CustomerResponse>(this.base, request);
    }

    updateCustomer(request: UpdateCustomerRequest): Observable<CustomerResponse> {
        return this.http.put<CustomerResponse>(`${this.base}/${request.id}`, request);
    }

    getCustomerById(id: string): Observable<CustomerResponse> {
        return this.http.get<CustomerResponse>(`${this.base}/${id}`);
    }

    listCustomers(): Observable<CustomerResponse[]> {
        return this.http.get<CustomerResponse[]>(this.base);
    }

    searchCustomers(query: string): Observable<CustomerSearchItem[]> {
        const q = query.trim();
        const url = q ? `${this.base}/search?query=${encodeURIComponent(q)}` : this.base;
        return this.http.get<CustomerSearchItem[]>(url);
    }
}
