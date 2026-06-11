// Cuenta corriente / "bolsa" de un proveedor: compras (débitos) y pagos (créditos).

export interface SupplierAccountListItem {
  supplierId: string;
  name: string;
  phone: string | null;
  saldoPendiente: number;
  saldoAFavor: number;
}

export interface SupplierAccountMovement {
  type: 'compra' | 'pago';
  id: string;
  date: string;
  description: string;
  code: string | null;
  amount: number;
  isDebit: boolean;
  status: number;
  statusName: string;
  method: string | null;
  chequeNumero: string | null;
}

export interface SupplierAccount {
  supplierId: string;
  supplierName: string;
  phone: string | null;
  email: string | null;
  deudaTotal: number;
  pagadoTotal: number;
  saldoPendiente: number;
  saldoAFavor: number;
  movements: SupplierAccountMovement[];
}

export interface AddSupplierPaymentRequest {
  method: number;
  amount: number;
  date: string;
  reference: string | null;
  notes: string | null;
  chequeId?: string | null;
}

export interface AddSupplierPaymentResult {
  paymentId: string;
  supplierId: string;
  amount: number;
  appliedToPurchases: number;
  creditAdded: number;
  supplierCreditBalance: number;
}
