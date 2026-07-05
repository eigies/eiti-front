import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Maneja los errores de carga de chunks lazy que aparecen cuando un usuario
 * tiene la app abierta durante un deploy: los chunks cambian de hash y el
 * `index.html` viejo (en memoria) pide un chunk que ya no existe, lo que
 * dispara un `ChunkLoadError`.
 *
 * La estrategia es recargar la página una sola vez para traer el `index.html`
 * y los chunks nuevos. Un guard por timestamp evita un loop de recargas si el
 * error persiste (p.ej. un chunk realmente roto): sólo se recarga si pasaron
 * más de 10s desde la última recarga automática.
 */
@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  private static readonly RELOAD_KEY = 'eiti:chunk-reload-at';
  private static readonly RELOAD_COOLDOWN_MS = 10_000;

  handleError(error: unknown): void {
    if (this.isChunkLoadError(error) && this.shouldReload()) {
      sessionStorage.setItem(ChunkErrorHandler.RELOAD_KEY, String(Date.now()));
      // Recarga desde el servidor para obtener el index.html + chunks vigentes.
      window.location.reload();
      return;
    }

    console.error(error);
  }

  private isChunkLoadError(error: unknown): boolean {
    const message = this.extractMessage(error);
    return (
      /ChunkLoadError/i.test(message) ||
      /Loading (?:CSS )?chunk [\w-]+ failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message) ||
      /error loading dynamically imported module/i.test(message) ||
      /Importing a module script failed/i.test(message)
    );
  }

  private shouldReload(): boolean {
    const last = Number(sessionStorage.getItem(ChunkErrorHandler.RELOAD_KEY) ?? 0);
    return Date.now() - last > ChunkErrorHandler.RELOAD_COOLDOWN_MS;
  }

  private extractMessage(error: unknown): string {
    if (!error) {
      return '';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    const wrapped = error as { message?: string; rejection?: { message?: string } };
    return wrapped.message ?? wrapped.rejection?.message ?? String(error);
  }
}
