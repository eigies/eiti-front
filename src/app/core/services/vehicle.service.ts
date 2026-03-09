import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateFleetLogRequest, CreateVehicleRequest, FleetLogResponse, VehicleResponse } from '../models/vehicle.models';

@Injectable({ providedIn: 'root' })
export class VehicleService {
    private readonly base = `${environment.apiUrl}/vehicles`;

    constructor(private http: HttpClient) { }

    listVehicles(): Observable<VehicleResponse[]> {
        return this.http.get<VehicleResponse[]>(this.base);
    }

    createVehicle(request: CreateVehicleRequest): Observable<VehicleResponse> {
        return this.http.post<VehicleResponse>(this.base, request);
    }

    createLog(vehicleId: string, request: CreateFleetLogRequest): Observable<FleetLogResponse> {
        return this.http.post<FleetLogResponse>(`${this.base}/${vehicleId}/logs`, request);
    }

    listLogs(vehicleId: string, filters?: { from?: string; to?: string; type?: number | null }): Observable<FleetLogResponse[]> {
        const params = new URLSearchParams();

        if (filters?.from) {
            params.set('from', filters.from);
        }

        if (filters?.to) {
            params.set('to', filters.to);
        }

        if (filters?.type) {
            params.set('type', String(filters.type));
        }

        const query = params.toString();
        return this.http.get<FleetLogResponse[]>(`${this.base}/${vehicleId}/logs${query ? `?${query}` : ''}`);
    }
}
