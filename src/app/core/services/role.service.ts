import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RoleDefinition } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class RoleService {
    private readonly base = `${environment.apiUrl}/roles`;

    constructor(private readonly http: HttpClient) {}

    listRoles(): Observable<RoleDefinition[]> {
        return this.http.get<RoleDefinition[]>(this.base);
    }
}
