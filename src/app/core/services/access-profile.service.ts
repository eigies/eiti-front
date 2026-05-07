import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    AccessProfileResponse,
    CreateAccessProfileRequest,
    UpdateAccessProfileRequest
} from '../models/access-profile.models';

@Injectable({ providedIn: 'root' })
export class AccessProfileService {
    private readonly base = `${environment.apiUrl}/access-profiles`;

    constructor(private readonly http: HttpClient) {}

    listAccessProfiles(): Observable<AccessProfileResponse[]> {
        return this.http.get<AccessProfileResponse[]>(this.base);
    }

    createAccessProfile(request: CreateAccessProfileRequest): Observable<AccessProfileResponse> {
        return this.http.post<AccessProfileResponse>(this.base, request);
    }

    updateAccessProfile(id: string, request: UpdateAccessProfileRequest): Observable<AccessProfileResponse> {
        return this.http.put<AccessProfileResponse>(`${this.base}/${id}`, request);
    }

    deleteAccessProfile(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
