import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/services/toast.service';
import { catchError, EMPTY } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);
    const token = auth.getToken();
    const isApiRequest = req.url.startsWith(environment.apiUrl);
    const isAuthRequest = req.url.startsWith(`${environment.apiUrl}/auth/`);

    if (token && isApiRequest) {
        const cloned = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(cloned).pipe(
            catchError(error => {
                if (error.status === 401 && !isAuthRequest) {
                    const shouldNotify = auth.markSessionExpiredHandled();
                    auth.logout();

                    if (shouldNotify) {
                        toast.error('Tu sesion expiro. Debes volver a iniciar sesion.');
                    }

                    void router.navigate(['/login']);
                    return EMPTY;
                }

                if (error.status === 429) {
                    toast.error('Demasiados intentos. Espera un momento antes de continuar.');
                    return EMPTY;
                }

                throw error;
            })
        );
    }

    return next(req);
};
