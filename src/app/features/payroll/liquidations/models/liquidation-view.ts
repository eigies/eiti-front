/** Funciones puras de la vista de liquidaciones. */

/** Clase de la etiqueta de estado: pendiente ámbar, pagada verde, cancelada gris. */
export function liquidationStatusBadge(status: number): string {
  if (status === 2) return 'ui-badge ui-badge--success';
  if (status === 3) return 'ui-badge';
  return 'ui-badge ui-badge--brand';
}
