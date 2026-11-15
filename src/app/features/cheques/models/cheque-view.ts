import { ChequeStatus } from '../../../core/models/cheque.models';

/** Color de cada estado: en cartera azul, depositado ámbar, acreditado y entregado verde, rechazado rojo, anulado gris. */
export function chequeStatusBadge(estado: number): string {
  switch (estado) {
    case ChequeStatus.EnCartera: return 'ui-badge ui-badge--info';
    case ChequeStatus.Depositado: return 'ui-badge ui-badge--brand';
    case ChequeStatus.Acreditado:
    case ChequeStatus.Entregado: return 'ui-badge ui-badge--success';
    case ChequeStatus.Rechazado: return 'ui-badge ui-badge--danger';
    default: return 'ui-badge';
  }
}

/** Botón de cada transición, con el mismo tono que antes. */
export function chequeTransitionButton(status: number): string {
  switch (status) {
    case ChequeStatus.Depositado: return 'secondary';
    case ChequeStatus.Acreditado: return 'primary';
    case ChequeStatus.Rechazado: return 'danger-ghost';
    default: return 'ghost';
  }
}
