import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OnboardingStatusResponse, OnboardingStep } from '../models/onboarding.models';
import { CashSessionResponse } from '../models/cash.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
    private readonly base = `${environment.apiUrl}/onboarding`;
    private readonly noticeKey = 'eiti_onboarding_completed_notice';
    private readonly acceptPrefix = 'eiti_onboarding_accept_';
    private readonly _status$ = new BehaviorSubject<OnboardingStatusResponse | null>(null);

    readonly status$ = this._status$.asObservable();

    constructor(private readonly http: HttpClient) { }

    get currentStatus(): OnboardingStatusResponse | null {
        return this._status$.value;
    }

    fetchStatus(force = false): Observable<OnboardingStatusResponse> {
        const cached = this._status$.value;

        if (!force && cached) {
            return of(cached);
        }

        return this.http.get<OnboardingStatusResponse>(`${this.base}/status`).pipe(
            tap(status => {
                const previous = this._status$.value;
                this._status$.next(status);

                if (previous && !previous.isCompleted && status.isCompleted) {
                    sessionStorage.setItem(this.noticeKey, '1');
                }
            })
        );
    }

    completeInitialCashOpen(cashDrawerId: string, openingAmount: number, notes?: string): Observable<CashSessionResponse> {
        return this.http.post<CashSessionResponse>(`${this.base}/complete-initial-cash-open`, { cashDrawerId, openingAmount, notes });
    }

    routeForStep(step: OnboardingStep): string | null {
        switch (step) {
            case 'Branch':
                return '/branches';
            case 'CashDrawer':
            case 'InitialCashOpen':
                return '/cash';
            case 'Product':
            case 'Stock':
                return '/products';
            default:
                return null;
        }
    }

    consumeCompletionNotice(): boolean {
        const shouldShow = sessionStorage.getItem(this.noticeKey) === '1';

        if (shouldShow) {
            sessionStorage.removeItem(this.noticeKey);
        }

        return shouldShow;
    }

    reset(): void {
        this._status$.next(null);
        sessionStorage.removeItem(this.noticeKey);
        this.clearAcceptedSteps();
    }

    isStepAccepted(step: OnboardingStep): boolean {
        return sessionStorage.getItem(`${this.acceptPrefix}${step}`) === '1';
    }

    acceptStep(step: OnboardingStep): void {
        sessionStorage.setItem(`${this.acceptPrefix}${step}`, '1');
    }

    private clearAcceptedSteps(): void {
        const knownSteps: OnboardingStep[] = ['Branch', 'CashDrawer', 'InitialCashOpen', 'Product', 'Stock', 'Done'];

        for (const step of knownSteps) {
            sessionStorage.removeItem(`${this.acceptPrefix}${step}`);
        }
    }
}
