import { ApplicationConfig, DEFAULT_CURRENCY_CODE, ErrorHandler, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { ChunkErrorHandler } from './core/handlers/chunk-error.handler';

// Formato argentino en todos los pipes: $ 89.900,00 y 14/11/2026.
registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: ChunkErrorHandler },
    { provide: LOCALE_ID, useValue: 'es-AR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'ARS' }
  ]
};
