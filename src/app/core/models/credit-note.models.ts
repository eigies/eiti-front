/** Nota de crédito: ajusta el saldo sin mover mercadería ni dinero. */
export interface CreateCreditNoteRequest {
  amount: number;
  /** Obligatorio: sin documento de origen, el motivo es la única trazabilidad del ajuste. */
  reason: string;
  date: string;
  /** Venta asociada (cliente). Opcional. */
  saleId?: string | null;
  /** Compra asociada (proveedor). Opcional. */
  purchaseId?: string | null;
}

export interface CreditNoteImputacion {
  code: string;
  amount: number;
}

export interface CreateCreditNoteResult {
  id: string;
  code: string;
  amount: number;
  imputaciones: CreditNoteImputacion[];
  /** Lo que no alcanzó a imputarse y quedó como saldo a favor. */
  sobrante: number;
}
