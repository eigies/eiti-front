// src/app/core/services/quote.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    QuoteListItem,
    QuoteDetailResponse,
    CreateQuoteRequest,
    ConvertQuoteRequest,
    ConvertQuoteResponse,
    ListQuotesFilters
} from '../models/quote.models';

@Injectable({ providedIn: 'root' })
export class QuoteService {
    private readonly base = `${environment.apiUrl}/quotes`;

    constructor(private readonly http: HttpClient) {}

    listQuotes(filters: ListQuotesFilters = {}): Observable<QuoteListItem[]> {
        const params: Record<string, string> = {};
        if (filters.idQuoteStatus) { params['idQuoteStatus'] = String(filters.idQuoteStatus); }
        if (filters.dateFrom) { params['dateFrom'] = filters.dateFrom; }
        if (filters.dateTo) { params['dateTo'] = filters.dateTo; }
        if (filters.customerId) { params['customerId'] = filters.customerId; }
        return this.http.get<QuoteListItem[]>(this.base, { params });
    }

    getQuoteById(id: string): Observable<QuoteDetailResponse> {
        return this.http.get<QuoteDetailResponse>(`${this.base}/${id}`);
    }

    createQuote(request: CreateQuoteRequest): Observable<QuoteDetailResponse> {
        return this.http.post<QuoteDetailResponse>(this.base, request);
    }

    cancelQuote(id: string): Observable<void> {
        return this.http.post<void>(`${this.base}/${id}/cancel`, {});
    }

    convertQuote(id: string, request: ConvertQuoteRequest): Observable<ConvertQuoteResponse> {
        return this.http.post<ConvertQuoteResponse>(`${this.base}/${id}/convert`, request);
    }
}
