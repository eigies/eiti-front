import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';

export const authGuard: CanActivateFn = (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const onboarding = inject(OnboardingService);

    if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
    }

    return onboarding.fetchStatus().pipe(
        map(status => {
            if (status.isCompleted) {
                return true;
            }

            const requiredRoute = onboarding.routeForStep(status.nextStep);
            const currentRoute = state.url.split('?')[0];

            if (requiredRoute && !currentRoute.startsWith(requiredRoute)) {
                return router.createUrlTree([requiredRoute]);
            }

            return true;
        }),
        catchError(() => {
            auth.logout();
            return of(router.createUrlTree(['/login']));
        })
    );
};
