// Extracto de cuenta corriente (proveedor o cliente): mismo contrato para los dos, así lo dibuja un solo
// componente (app-account-ledger). Saldo positivo = se debe; negativo = saldo a favor.

/** Qué es el renglón. */
export type LedgerRowKind = 'invoice' | 'payment' | 'credit_note';

/**
 * De dónde sale el renglón y, con eso, cómo se anula: una orden de pago / un recibo se anulan enteros;
 * un pago sin grupo (anterior a las órdenes) por su endpoint de siempre; lo "legacy" (pagos cargados en
 * la compra/venta antes de la cuenta corriente) no se anula desde acá.
 */
export type LedgerRowSource = 'purchase' | 'sale' | 'payment_order' | 'receipt' | 'payment' | 'legacy' | 'credit_note';

export type PaymentMeansMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other';

/** Un medio dentro de un pago/cobro. */
export interface LedgerMeans {
  paymentId: string;
  method: PaymentMeansMethod;
  methodLabel: string;
  amount: number;
  reference: string | null;
  chequeNumber: string | null;
  bankName: string | null;
  dueDate: string | null;
  cardInstallments: number | null;
  cardSurcharge: number | null;
}

/** A qué factura/venta se aplicó (parte de) un pago, cobro o nota de crédito. */
export interface LedgerImputation {
  documentId: string;
  code: string;
  document: string | null;
  amount: number;
}

export interface LedgerRow {
  kind: LedgerRowKind;
  source: LedgerRowSource;
  id: string;
  date: string;
  code: string | null;
  document: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  isCancelled: boolean;
  means: LedgerMeans[];
  imputations: LedgerImputation[];
}

/** Factura/venta con saldo, para la pestaña Pendientes. */
export interface PendingDocument {
  id: string;
  date: string;
  code: string;
  document: string | null;
  total: number;
  imputed: number;
  pending: number;
  ageDays: number;
}

export interface AccountLedger {
  accountId: string;
  accountName: string;
  dateFrom: string | null;
  dateTo: string | null;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  rows: LedgerRow[];
  pending: PendingDocument[];
}

/** Filtro del extracto. Fechas en formato yyyy-MM-dd (día del usuario). */
export interface LedgerQuery {
  dateFrom: string | null;
  dateTo: string | null;
  includeCancelled: boolean;
}

/** Textos que cambian entre la cuenta de un proveedor y la de un cliente. */
export interface AccountLedgerLabels {
  invoice: string;        // 'Compra' | 'Venta'
  payment: string;        // 'Pago' | 'Cobro'
  group: string;          // 'Orden de pago' | 'Recibo'
  documents: string;      // 'facturas' | 'ventas'
  payPending: string;     // 'Pagar seleccionadas' | 'Cobrar seleccionadas'
  printGroup: string;     // 'Imprimir OP' | 'Imprimir recibo'
  cancelGroup: string;    // 'Anular pago' | 'Anular cobro'
  exportName: string;     // prefijo del archivo exportado
}

export const SUPPLIER_LEDGER_LABELS: AccountLedgerLabels = {
  invoice: 'Compra',
  payment: 'Pago',
  group: 'Orden de pago',
  documents: 'facturas',
  payPending: 'Pagar seleccionadas',
  printGroup: 'Imprimir OP',
  cancelGroup: 'Anular pago',
  exportName: 'extracto-proveedor'
};

export const CUSTOMER_LEDGER_LABELS: AccountLedgerLabels = {
  invoice: 'Venta',
  payment: 'Cobro',
  group: 'Recibo',
  documents: 'ventas',
  payPending: 'Cobrar seleccionadas',
  printGroup: 'Imprimir recibo',
  cancelGroup: 'Anular cobro',
  exportName: 'extracto-cliente'
};

// ── Pago / cobro con varios medios ──────────────────────────────────────────

/** Cheque que el cliente nos da en un cobro: se crea y entra a cartera. */
export interface GroupedPaymentCheque {
  bankId: number;
  numero: string;
  titular: string;
  cuitDni: string;
  monto: number;
  fechaEmision: string;
  fechaVencimiento: string;
  notas: string | null;
}

/** Un medio tal como sale del modal. Los campos que no aplican al medio van en null. */
export interface GroupedPaymentLine {
  method: number;
  amount: number;
  reference: string | null;
  chequeId: string | null;         // proveedor: cheque de cartera entregado
  cardBankId: number | null;       // cliente: tarjeta
  cardCuotas: number | null;
  transferBankId: number | null;   // cliente: banco receptor de la transferencia
  cheque: GroupedPaymentCheque | null; // cliente: cheque recibido
}

export interface GroupedPaymentSubmit {
  date: string;
  notes: string | null;
  lines: GroupedPaymentLine[];
}
