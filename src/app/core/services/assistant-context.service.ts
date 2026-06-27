import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ScreenContext } from '../models/assistant.models';

/**
 * Holds the context of the screen the user is currently looking at, so the AI bubble
 * can ground its answers. The screen label is derived automatically from the route on
 * every navigation; any screen can enrich it with filters/data via `set()`/`setData()`.
 *
 * Navigating resets the context to just the new screen label, so stale data from the
 * previous screen never leaks into a question.
 */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  private readonly _ctx$ = new BehaviorSubject<ScreenContext>({});
  readonly ctx$ = this._ctx$.asObservable();

  // Route fragment -> human label. First match wins; falls back to a prettified segment.
  private readonly labels: ReadonlyArray<[string, string]> = [
    ['reportes/medios-pago', 'Reporte de medios de pago'],
    ['reportes/movimientos-stock', 'Reporte de movimientos de stock'],
    ['reportes/ventas', 'Reporte de ventas'],
    ['reportes/deudores', 'Reporte de clientes deudores'],
    ['reportes/caja', 'Reporte de caja'],
    ['reportes/stock', 'Reporte de stock por sucursal'],
    ['reportes', 'Reportería'],
    ['sales', 'Ventas'],
    ['cash', 'Caja'],
    ['purchases', 'Compras'],
    ['clients', 'Clientes'],
    ['products', 'Productos'],
    ['dashboard', 'Panel principal']
  ];

  constructor(router: Router) {
    this._ctx$.next({ screen: this.labelFor(router.url) });
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this._ctx$.next({ screen: this.labelFor(e.urlAfterRedirects) }));
  }

  /** Merge partial context (e.g. active filters) into the current screen context. */
  set(ctx: Partial<ScreenContext>): void {
    this._ctx$.next({ ...this._ctx$.value, ...ctx });
  }

  /** Convenience for screens to publish the data the user is currently seeing. */
  setData(data: unknown, description?: string): void {
    this._ctx$.next({ ...this._ctx$.value, data, ...(description ? { description } : {}) });
  }

  snapshot(): ScreenContext {
    return this._ctx$.value;
  }

  private labelFor(url: string): string {
    const path = url.split('?')[0].replace(/^\//, '');
    for (const [fragment, label] of this.labels) {
      if (path.startsWith(fragment)) {
        return label;
      }
    }
    const first = path.split('/')[0] || 'Inicio';
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
}
