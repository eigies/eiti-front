// Cuenta corriente / "bolsa" de un proveedor: compras (débitos) y pagos (créditos).

export interface SupplierAccountListItem {
  supplierId: string;
  name: string;
  phone: string | null;
  saldoPendiente: number;
  saldoAFavor: number;
}

// Detalle de a qué factura se imputó parte de un pago y por cuánto.
export interface SupplierPaymentImputacion {
  purchaseId: string;
  code: string;                 // COMP-XXXX
  invoiceNumber: string | null; // Nº de factura del proveedor
  amount: number;
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
  imputaciones: SupplierPaymentImputacion[] | null; // facturas que cubrió este pago
  sobrante: number | null;                          // excedente del pago a saldo a favor
  reference: string | null;                         // referencia ingresada al registrar el pago
  notes: string | null;                             // nota ingresada al registrar el pago
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
  imputaciones: SupplierPaymentImputacion[];
}
