export enum PurchaseStatus {
  Active = 1,
  Paid = 2,
  Cancelled = 3
}

export enum PurchasePaymentMethod {
  Cash = 1,
  BankTransfer = 2,
  Check = 3,
  Other = 4
}

export interface PurchaseListItem {
  id: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  status: PurchaseStatus;
  totalAmount: number;
  totalPaid: number;
  pendingAmount: number;
  createdAt: string;
  detailCount: number;
}

export interface PurchaseDetail {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
}

export interface PurchasePayment {
  id: string;
  method: PurchasePaymentMethod;
  amount: number;
  status: number; // 1=Active, 2=Cancelled
  reference: string | null;
  notes: string | null;
  date: string;
  createdAt: string;
  ivaPct: number | null;
  ingresosBrutosPct: number | null;
  ivaAmount: number | null;
  ingresosBrutosAmount: number | null;
}

export interface PurchaseDetailResponse {
  id: string;
  code: string;
  supplierId: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  status: PurchaseStatus;
  statusName: string;
  totalAmount: number;
  totalPaid: number;
  pendingAmount: number;
  createdAt: string;
  paidAt: string | null;
  details: PurchaseDetail[];
  payments: PurchasePayment[];
}

export interface CreatePurchaseDetailRequest {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchasePaymentRequest {
  method: number;
  amount: number;
  date: string;
  reference: string | null;
  notes: string | null;
  ivaPct: number | null;
  ingresosBrutosPct: number | null;
}

export interface CreatePurchaseRequest {
  branchId: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  details: CreatePurchaseDetailRequest[];
  payments: CreatePurchasePaymentRequest[];
}

export interface AddPurchasePaymentRequest {
  method: number;
  amount: number;
  date: string;
  reference: string | null;
  notes: string | null;
  ivaPct: number | null;
  ingresosBrutosPct: number | null;
}

export interface PurchaseListResponse {
  items: PurchaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}
