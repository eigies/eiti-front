import { inject } from '@angular/core';
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/services/toast.service';
import { BehaviorSubject, catchError, EMPTY, filter, switchMap, take, throwError } from 'rxjs';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);

    const isApiRequest = req.url.startsWith(environment.apiUrl);
    const isAuthRequest = req.url.includes('/auth/login') ||
                          req.url.includes('/auth/register') ||
                          req.url.includes('/auth/refresh');

    const token = auth.getToken();
    const authedReq = (token && isApiRequest)
        ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
        : req;

    return next(authedReq).pipe(
        catchError(error => {
            if (error.status === 401 && !isAuthRequest && isApiRequest) {
                return handle401(req, next, auth, toast, router);
            }
            if (error.status === 429) {
                toast.error('Demasiados intentos. Espera un momento antes de continuar.');
                return EMPTY;
            }
            return throwError(() => error);
        })
    );
};

function handle401(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
    auth: AuthService,
    toast: ToastService,
    router: Router
) {
    if (isRefreshing) {
        return refreshTokenSubject.pipe(
            filter((token): token is string => token !== null),
            take(1),
            switchMap(token =>
                next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) }))
            )
        );
    }

    isRefreshing = true;
    refreshTokenSubject.next(null);

    return auth.refreshToken().pipe(
        switchMap(res => {
            isRefreshing = false;
            auth.saveNewToken(res.token, res.refreshToken);
            refreshTokenSubject.next(res.token);
            return next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${res.token}`) }));
        }),
        catchError(err => {
            isRefreshing = false;
            auth.logout();
            toast.error('Tu sesion expiro. Debes volver a iniciar sesion.');
            void router.navigate(['/login']);
            return throwError(() => err);
        })
    );
}
