import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  detail?: string;
  message?: string;
}

/**
 * Extrae el mensaje de error de una respuesta de API de forma tipada.
 * Centraliza el patrón `err?.error?.detail || err?.error?.message || fallback`
 * que estaba duplicado (~93 veces) y elimina los `as any`.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const body = (err as HttpErrorResponse | undefined)?.error as ApiErrorBody | string | undefined;

  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    return body.detail || body.message || fallback;
  }

  return fallback;
}
