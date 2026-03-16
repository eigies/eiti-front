import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
    let http: HttpClient;
    let httpTesting: HttpTestingController;
    let authSpy: jasmine.SpyObj<AuthService>;
    let toastSpy: jasmine.SpyObj<ToastService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        authSpy = jasmine.createSpyObj('AuthService', ['getToken', 'logout', 'markSessionExpiredHandled']);
        toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: authSpy },
                { provide: ToastService, useValue: toastSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });

        http = TestBed.inject(HttpClient);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTesting.verify();
    });

    it('should handle HTTP 429 by showing toast and completing', (done: DoneFn) => {
        authSpy.getToken.and.returnValue('fake-token');

        http.get(`${environment.apiUrl}/some-endpoint`).subscribe({
            next: () => fail('should not emit next'),
            error: () => fail('should not emit error'),
            complete: () => {
                expect(toastSpy.error).toHaveBeenCalledWith(
                    'Demasiados intentos. Espera un momento antes de continuar.'
                );
                done();
            }
        });

        const req = httpTesting.expectOne(`${environment.apiUrl}/some-endpoint`);
        req.flush(null, { status: 429, statusText: 'Too Many Requests' });
    });
});
