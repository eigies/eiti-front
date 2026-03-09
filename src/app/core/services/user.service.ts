import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserRequest, UpdateUserRolesRequest, UserResponse, UserRoleAuditResponse } from '../models/user.models';

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

    updateRoles(id: string, request: UpdateUserRolesRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.base}/${id}/roles`, request);
    }

    setStatus(id: string, isActive: boolean): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.base}/${id}/status`, { isActive });
    }

    listRoleAudits(userId?: string | null, take = 50): Observable<UserRoleAuditResponse[]> {
        const params = new URLSearchParams();
        params.set('take', String(take));

        if (userId) {
            params.set('userId', userId);
        }

        const query = params.toString();
        return this.http.get<UserRoleAuditResponse[]>(`${this.base}/role-audits?${query}`);
    }
}
