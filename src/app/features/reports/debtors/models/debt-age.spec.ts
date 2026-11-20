import { debtAgeBadge, debtAgeDays } from './debt-age';

describe('debt-age', () => {
  it('cuenta días calendario desde la venta más antigua', () => {
    expect(debtAgeDays('2026-11-01T15:00:00', new Date(2026, 10, 15, 9))).toBe(14);
  });

  it('pinta ámbar desde 15 días y rojo desde 60', () => {
    expect(debtAgeBadge(14)).toBe('ui-badge');
    expect(debtAgeBadge(15)).toContain('warning');
    expect(debtAgeBadge(59)).toContain('warning');
    expect(debtAgeBadge(60)).toContain('danger');
  });
});
