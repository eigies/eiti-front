import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../models/auth.models';
import { OnboardingService } from './onboarding.service';
import { UserResponse } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly TOKEN_KEY = 'eiti_token';
    private readonly USER_KEY = 'eiti_user';
    private readonly REFRESH_TOKEN_KEY = 'eiti_refresh_token';
    private sessionExpiredHandled = false;

    private _currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());
    currentUser$ = this._currentUser$.asObservable();

    constructor(
        private http: HttpClient,
        private onboarding: OnboardingService
    ) {
        if (this.getToken()) {
            this.refreshCurrentUserProfile();
        }
    }

    register(request: RegisterRequest): Observable<AuthResponse> {
        return this.http
            .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
            .pipe(tap(res => this.persist(res)));
    }

    login(request: LoginRequest): Observable<AuthResponse> {
        return this.http
            .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
            .pipe(tap(res => this.persist(res)));
    }

    requestPasswordReset(request: ForgotPasswordRequest): Observable<void> {
        return this.http.post<void>(`${environment.apiUrl}/auth/forgot-password`, request);
    }

    resetPassword(request: ResetPasswordRequest): Observable<void> {
        return this.http.post<void>(`${environment.apiUrl}/auth/reset-password`, request);
    }

    logout(): void {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        this.onboarding.reset();
        this.sessionExpiredHandled = false;
        this._currentUser$.next(null);
    }

    getRefreshToken(): string | null {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    refreshToken(): Observable<{ token: string; refreshToken: string }> {
        const refreshToken = this.getRefreshToken();
        return this.http.post<{ token: string; refreshToken: string }>(
            `${environment.apiUrl}/auth/refresh`,
            { refreshToken }
        );
    }

    saveNewToken(token: string, refreshToken: string): void {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
        const current = this._currentUser$.value;
        if (current) {
            const updated: AuthResponse = { ...current, token, refreshToken };
            localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
            this._currentUser$.next(updated);
        }
    }

    getToken(): string | null {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    hasPermission(permission: string): boolean {
        return !!this.currentUser?.permissions?.some(value => value === permission);
    }

    get currentUser(): AuthResponse | null {
        return this._currentUser$.value;
    }

    private persist(res: AuthResponse): void {
        this.onboarding.reset();
        this.sessionExpiredHandled = false;
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refreshToken);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res));
        this._currentUser$.next(res);
        this.refreshCurrentUserProfile();
    }

    refreshCurrentUserProfile(): void {
        const current = this._currentUser$.value;
        const token = this.getToken();
        if (!current || !token) {
            return;
        }

        this.http.get<UserResponse>(`${environment.apiUrl}/users/me`).subscribe({
            next: profile => {
                const merged: AuthResponse = {
                    ...current,
                    userId: profile.id || current.userId,
                    username: profile.username || current.username,
                    email: profile.email || current.email,
                    profileId: profile.profileId ?? current.profileId ?? null,
                    profileName: profile.profileName ?? current.profileName ?? null,
                    permissions: profile.permissions ?? current.permissions ?? [],
                    assignedCashDrawerId: current.assignedCashDrawerId ?? null
                };

                localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
                this._currentUser$.next(merged);
            },
            error: () => undefined
        });
    }

    markSessionExpiredHandled(): boolean {
        if (this.sessionExpiredHandled) {
            return false;
        }

        this.sessionExpiredHandled = true;
        return true;
    }

    private loadUser(): AuthResponse | null {
        const stored = localStorage.getItem(this.USER_KEY);
        if (!stored) {
            return null;
        }

        const parsed = JSON.parse(stored) as Partial<AuthResponse>;
        return {
            userId: parsed.userId ?? '',
            username: parsed.username ?? '',
            email: parsed.email ?? '',
            token: parsed.token ?? '',
            refreshToken: parsed.refreshToken ?? '',
            profileId: parsed.profileId ?? null,
            profileName: parsed.profileName ?? null,
            permissions: parsed.permissions ?? [],
            assignedCashDrawerId: parsed.assignedCashDrawerId ?? null
        };
    }
}
