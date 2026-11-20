import { AuditLogItem } from '../../../core/models/audit.models';

/** Un día de la auditoría: su título y las acciones de ese día, en el orden en que llegaron. */
export interface AuditDayGroup {
  key: string;
  title: string;
  items: AuditLogItem[];
}

const DAY_FORMAT = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Agrupa por día local: "Sábado 14 de noviembre · 6 acciones · 1 con error". */
export function groupAuditByDay(items: readonly AuditLogItem[]): AuditDayGroup[] {
  const groups: AuditDayGroup[] = [];
  for (const item of items) {
    const date = new Date(item.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, title: '', items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  for (const group of groups) {
    const first = new Date(group.items[0].timestamp);
    const day = DAY_FORMAT.format(first).replace(',', '');
    const errors = group.items.filter(item => !item.succeeded).length;
    const count = group.items.length;
    group.title = `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${count} ${count === 1 ? 'acción' : 'acciones'}`
      + (errors > 0 ? ` · ${errors} con error` : '');
  }
  return groups;
}

/** Color de la pastilla según el tipo de acción (mismos colores que los movimientos). */
export function auditActionTone(actionType: string): string {
  const type = actionType.toLowerCase();
  if (type.includes('cancel') || type.includes('delete') || type.includes('deactivate') || type.includes('withdrawal')) return 'ui-mov--out';
  if (type.includes('cashtransfer') || type.includes('transferstock')) return 'ui-mov--transfer-out';
  if (type.startsWith('createcc') || type.includes('ccpayment') || type.includes('customerreceipt')) return 'ui-mov--cc';
  if (type.includes('purchase') || type.includes('supplier')) return 'ui-mov--supplier';
  if (type.includes('payroll')) return 'ui-mov--payroll';
  if (type.includes('sale')) return 'ui-mov--sale';
  if (type.includes('opencash') || type.includes('deposit')) return 'ui-mov--in';
  return 'ui-mov--neutral';
}
