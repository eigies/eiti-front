import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserRequest, UpdateUserProfileRequest, UserProfileAuditResponse, UserResponse } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserService {
    private readonly base = `${environment.apiUrl}/users`;

    constructor(private readonly http: HttpClient) {}

    listUsers(): Observable<UserResponse[]> {
        return this.http.get<UserResponse[]>(this.base);
    }

    getMyProfile(): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.base}/me`);
    }

    createUser(request: CreateUserRequest): Observable<UserResponse> {
        return this.http.post<UserResponse>(this.base, request);
    }

    updateProfile(id: string, request: UpdateUserProfileRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.base}/${id}/profile`, request);
    }

    setStatus(id: string, isActive: boolean): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.base}/${id}/status`, { isActive });
    }

    listProfileAudits(userId?: string | null, take = 50): Observable<UserProfileAuditResponse[]> {
        const params = new URLSearchParams();
        params.set('take', String(take));

        if (userId) {
            params.set('userId', userId);
        }

        const query = params.toString();
        return this.http.get<UserProfileAuditResponse[]>(`${this.base}/profile-audits?${query}`);
    }
}
