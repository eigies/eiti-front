// Cuenta corriente / "bolsa" de un cliente: ventas CC (débitos) y cobros (créditos).
// Espejo de supplier-account.models.ts adaptado a clientes (type 'venta' | 'cobro').

export interface CustomerAccountListItem {
  customerId: string;
  name: string;
  phone: string | null;
  documentNumber: string | null;
  taxId: string | null;
  saldoPendiente: number;
  saldoAFavor: number;
}

// Detalle de a qué venta se imputó parte de un cobro y por cuánto.
export interface CustomerPaymentImputacion {
  saleId: string;
  code: string;        // VENTA-XXXX
  amount: number;
}

export interface CustomerAccountMovement {
  type: 'venta' | 'cobro';
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
  imputaciones: CustomerPaymentImputacion[] | null; // ventas que cubrió este cobro
  sobrante: number | null;                          // excedente del cobro a saldo a favor
}

export interface CustomerAccount {
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  deudaTotal: number;
  cobradoTotal: number;
  saldoPendiente: number;
  saldoAFavor: number;
  movements: CustomerAccountMovement[];
}

// Datos del cheque que el cliente NOS DA en un cobro (se crea y entra a cartera).
export interface AddCustomerPaymentCheque {
  bankId: number;
  numero: string;
  titular: string;
  cuitDni: string;
  monto: number;
  fechaEmision: string;
  fechaVencimiento: string;
  notas: string | null;
}

export interface AddCustomerPaymentRequest {
  method: number;
  amount: number;
  date: string;
  reference?: string | null;
  notes?: string | null;
  cardBankId?: number | null;
  cardCuotas?: number | null;
  cheque?: AddCustomerPaymentCheque | null;
}

export interface AddCustomerPaymentResult {
  paymentId: string;
  customerId: string;
  amount: number;
  appliedToSales: number;
  creditAdded: number;
  customerCreditBalance: number;
  imputaciones: CustomerPaymentImputacion[];
}

export interface CustomerPaymentLink {
  paymentId: string;
  customerId: string;
  amount: number;
  method: number;
  status: number;
  date: string;
}
