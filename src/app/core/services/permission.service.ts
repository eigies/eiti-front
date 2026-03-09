import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
    constructor(private readonly auth: AuthService) {}

    has(permission: string): boolean {
        return this.auth.hasPermission(permission);
    }

    hasAny(permissions: string[]): boolean {
        return permissions.some(permission => this.has(permission));
    }

    hasAll(permissions: string[]): boolean {
        return permissions.every(permission => this.has(permission));
    }
}
