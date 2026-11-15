/** Días desde la venta abierta más antigua (en días calendario locales). */
export function debtAgeDays(oldestDate: string, today: Date = new Date()): number {
  const start = new Date(oldestDate);
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/** Antigüedad con color: 15 días o más en ámbar, 60 o más en rojo. */
export function debtAgeBadge(days: number): string {
  if (days >= 60) return 'ui-badge ui-badge--danger';
  if (days >= 15) return 'ui-badge ui-badge--warning';
  return 'ui-badge';
}
