export enum ChequeStatus {
  EnCartera = 1,
  Depositado = 2,
  Acreditado = 3,
  Rechazado = 4,
  Anulado = 5
}

export interface ChequeListItem {
  id: string;
  numero: string;
  bankName: string;
  titular: string;
  monto: number;
  fechaVencimiento: string;
  estado: number;
  estadoName: string;
  saleCode: string | null;
  saleType: string;
}

export interface ChequeDetail {
  id: string;
  numero: string;
  bankId: number;
  bankName: string;
  titular: string;
  cuitDni: string;
  monto: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: number;
  estadoName: string;
  notas: string | null;
  saleCode: string | null;
  saleType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChequeFilters {
  estado?: number | null;
  bankId?: number | null;
  fechaVencFrom?: string | null;
  fechaVencTo?: string | null;
}

export const CHEQUE_TRANSITIONS: Record<number, number[]> = {
  [ChequeStatus.EnCartera]: [ChequeStatus.Depositado, ChequeStatus.Anulado],
  [ChequeStatus.Depositado]: [ChequeStatus.Acreditado, ChequeStatus.Rechazado, ChequeStatus.Anulado],
  [ChequeStatus.Acreditado]: [],
  [ChequeStatus.Rechazado]: [],
  [ChequeStatus.Anulado]: []
};

export const CHEQUE_STATUS_LABELS: Record<number, string> = {
  [ChequeStatus.EnCartera]: 'En cartera',
  [ChequeStatus.Depositado]: 'Depositado',
  [ChequeStatus.Acreditado]: 'Acreditado',
  [ChequeStatus.Rechazado]: 'Rechazado',
  [ChequeStatus.Anulado]: 'Anulado'
};

export const CHEQUE_STATUS_BADGE: Record<number, string> = {
  [ChequeStatus.EnCartera]: 'badge badge--pending',
  [ChequeStatus.Depositado]: 'badge badge--amber',
  [ChequeStatus.Acreditado]: 'badge badge--in',
  [ChequeStatus.Rechazado]: 'badge badge--out',
  [ChequeStatus.Anulado]: 'badge badge--muted'
};
