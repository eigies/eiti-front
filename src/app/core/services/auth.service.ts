import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../models/auth.models';
import { OnboardingService } from './onboarding.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly TOKEN_KEY = 'eiti_token';
    private readonly USER_KEY = 'eiti_user';
    private sessionExpiredHandled = false;

    private _currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());
    currentUser$ = this._currentUser$.asObservable();

    constructor(
        private http: HttpClient,
        private onboarding: OnboardingService
    ) { }

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
        this.onboarding.reset();
        this.sessionExpiredHandled = false;
        this._currentUser$.next(null);
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

    hasRole(role: string): boolean {
        return !!this.currentUser?.roles?.some(value => value === role);
    }

    get currentUser(): AuthResponse | null {
        return this._currentUser$.value;
    }

    private persist(res: AuthResponse): void {
        this.onboarding.reset();
        this.sessionExpiredHandled = false;
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res));
        this._currentUser$.next(res);
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
            roles: parsed.roles ?? [],
            permissions: parsed.permissions ?? []
        };
    }
}
