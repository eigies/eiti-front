import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChequeDetail, ChequeFilters, ChequeListItem, OwnChequeDue } from '../models/cheque.models';

@Injectable({ providedIn: 'root' })
export class ChequeService {
  private readonly base = `${environment.apiUrl}/cheques`;

  constructor(private readonly http: HttpClient) {}

  listCheques(filters: ChequeFilters = {}): Observable<ChequeListItem[]> {
    let params = new HttpParams();
    if (filters.estado != null) params = params.set('estado', String(filters.estado));
    if (filters.bankId != null) params = params.set('bankId', String(filters.bankId));
    if (filters.fechaVencFrom) params = params.set('fechaVencFrom', filters.fechaVencFrom);
    if (filters.fechaVencTo) params = params.set('fechaVencTo', filters.fechaVencTo);
    if (filters.numero) params = params.set('numero', filters.numero);
    if (filters.origen != null) params = params.set('origen', String(filters.origen));
    return this.http.get<ChequeListItem[]>(this.base, { params });
  }

  /** Cheques propios que vencen hoy: el aviso al entrar a EITI. */
  listOwnDue(): Observable<OwnChequeDue[]> {
    return this.http.get<OwnChequeDue[]>(`${this.base}/own/due`);
  }

  getChequeById(id: string): Observable<ChequeDetail> {
    return this.http.get<ChequeDetail>(`${this.base}/${id}`);
  }

  updateChequeStatus(id: string, newStatus: number): Observable<ChequeDetail> {
    return this.http.patch<ChequeDetail>(`${this.base}/${id}/status`, { newStatus });
  }
}
