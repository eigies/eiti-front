import { AccountLedgerLabels, LedgerMeans, LedgerRow } from '../../core/models/account-ledger.models';
import { formatMoney } from './money.util';

/**
 * dd/mm/aaaa de una fecha de negocio que llega como "2026-10-02T00:00:00". Se corta el string en vez
 * de pasar por Date: un "2026-10-02" suelto se parsea como UTC y en Argentina mostraría el día anterior.
 */
export function formatLedgerDate(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
}

/** dd/mm, para listas compactas (vencimientos de cheques). */
export function formatShortDate(value: string | null | undefined): string {
  return formatLedgerDate(value).slice(0, 5);
}

/** Detalle de un medio: "Nº 00012345 · Nación · vto 20/10", "Galicia · 3 cuotas (+$20.000,00)", la referencia… */
export function meansDetail(means: LedgerMeans): string {
  const parts: string[] = [];
  if (means.method === 'check') {
    if (means.chequeNumber) parts.push(`Nº ${means.chequeNumber}`);
    if (means.bankName) parts.push(means.bankName);
    if (means.dueDate) parts.push(`vto ${formatShortDate(means.dueDate)}`);
  } else if (means.method === 'card') {
    if (means.bankName) parts.push(means.bankName);
    if (means.cardInstallments) {
      const surcharge = means.cardSurcharge ? ` (+$${formatMoney(means.cardSurcharge)})` : '';
      parts.push(`${means.cardInstallments} cuota${means.cardInstallments > 1 ? 's' : ''}${surcharge}`);
    }
  } else if (means.method === 'transfer') {
    if (means.bankName) parts.push(means.bankName);
  }
  if (means.reference) parts.push(means.reference);
  return parts.join(' · ') || '—';
}

const MEANS_PLURAL: Record<string, [string, string]> = {
  check: ['cheque', 'cheques'],
  transfer: ['transf.', 'transf.'],
  cash: ['efectivo', 'efectivo'],
  card: ['tarjeta', 'tarjetas'],
  other: ['otro', 'otros']
};

/** Resumen de los medios de un pago agrupado: "5 medios · 3 cheques + transf. + efectivo". */
export function meansSummary(means: LedgerMeans[]): string {
  if (means.length === 0) return '';
  const counts = new Map<string, number>();
  for (const m of means) counts.set(m.method, (counts.get(m.method) ?? 0) + 1);
  const parts = [...counts.entries()].map(([method, count]) => {
    const [one, many] = MEANS_PLURAL[method] ?? ['otro', 'otros'];
    return count > 1 && one !== many ? `${count} ${many}` : one;
  });
  if (means.length === 1) return means[0].methodLabel;
  return `${means.length} medios · ${parts.join(' + ')}`;
}

/** Comprobante del renglón: su código, o una etiqueta si no tiene número (pagos anteriores a las OP/RC). */
export function rowTitle(row: LedgerRow, labels: AccountLedgerLabels): string {
  if (row.code) return row.code;
  if (row.source === 'trade_in') return 'Canje';
  if (row.kind === 'payment') return labels.payment;
  if (row.kind === 'invoice') return labels.invoice;
  return 'Nota de crédito';
}

/** Línea secundaria del comprobante: nº de factura, tipo de comprobante, etc. */
export function rowSubtitle(row: LedgerRow, labels: AccountLedgerLabels): string {
  switch (row.source) {
    case 'purchase':
    case 'sale':
      return row.document ? `Fact. ${row.document}` : row.description;
    case 'payment_order':
    case 'receipt':
      return labels.group;
    case 'credit_note':
      return 'Nota de crédito';
    default:
      return row.description;
  }
}

// Lo que el backend pone como descripción de un pago cuando el usuario no escribió una nota.
const DEFAULT_PAYMENT_DESCRIPTIONS = new Set(['Orden de pago', 'Recibo', 'Pago', 'Cobro']);

/** Texto de la columna Detalle: para un pago, el resumen de sus medios (y la nota, si hay). */
export function rowDetail(row: LedgerRow): string {
  if (row.kind !== 'payment' || row.source === 'legacy' || row.source === 'trade_in') return row.description;
  const summary = meansSummary(row.means);
  return DEFAULT_PAYMENT_DESCRIPTIONS.has(row.description) ? summary : `${summary} · ${row.description}`;
}
