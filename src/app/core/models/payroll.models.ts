export type PayrollPeriodicity = 1 | 2; // 1 Monthly, 2 Biweekly
export const PAYROLL_PERIODICITIES: { value: PayrollPeriodicity; label: string }[] = [
  { value: 1, label: 'Mensual' },
  { value: 2, label: 'Quincenal' },
];

export type PayrollPaymentMethod = 1 | 2 | 3; // 1 Cash, 2 Transfer, 3 Other
export const PAYROLL_PAYMENT_METHODS: { value: PayrollPaymentMethod; label: string }[] = [
  { value: 1, label: 'Efectivo' },
  { value: 2, label: 'Transferencia' },
  { value: 3, label: 'Otro' },
];

export interface DeductionConceptResponse {
  id: string;
  name: string;
  percentage: number;
  isActive: boolean;
}
export interface CreateDeductionConceptRequest { name: string; percentage: number; }
export interface UpdateDeductionConceptRequest { name: string; percentage: number; }

export interface PayrollAdvanceResponse {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  notes: string | null;
  status: number; // 1 Pending, 2 Applied, 3 Cancelled
  appliedToLiquidationId: string | null;
  cashSessionId: string | null;
}
export interface CreatePayrollAdvanceRequest {
  employeeId: string;
  amount: number;
  date: string;
  notes: string | null;
  paymentMethod: PayrollPaymentMethod;
  cashSessionId: string | null;
}

export interface BonusConceptResponse {
  id: string;
  name: string;
  isActive: boolean;
}
export interface CreateBonusConceptRequest { name: string; }
export interface UpdateBonusConceptRequest { name: string; }

export type PayrollBonusAmountType = 1 | 2; // 1 FixedAmount, 2 Percentage
export const PAYROLL_BONUS_AMOUNT_TYPES: { value: PayrollBonusAmountType; label: string }[] = [
  { value: 1, label: 'Monto fijo' },
  { value: 2, label: 'Porcentaje del sueldo base' },
];

export interface PayrollBonusResponse {
  id: string;
  employeeId: string;
  conceptId: string;
  amountType: PayrollBonusAmountType;
  value: number;
  notes: string | null;
  status: number; // 1 Pending, 2 Applied, 3 Cancelled
  payrollLiquidationId: string | null;
}
export interface CreatePayrollBonusRequest {
  employeeId: string;
  conceptId: string;
  amountType: PayrollBonusAmountType;
  value: number;
  notes: string | null;
}

export interface PayrollLiquidationLineResponse { label: string; amount: number; }
export interface PayrollLiquidationResponse {
  id: string;
  employeeId: string;
  periodLabel: string;
  grossAmount: number;
  netAmount: number;
  status: number; // 1 Pending, 2 Paid, 3 Cancelled
  paymentMethod: number | null;
  paidAt: string | null;
  deductionLines: PayrollLiquidationLineResponse[];
  advanceLines: PayrollLiquidationLineResponse[];
  bonusLines: PayrollLiquidationLineResponse[];
}
export interface ListLiquidationsResponse {
  items: PayrollLiquidationResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface PayrollLiquidationSummary { id: string; employeeId: string; employeeName: string; netAmount: number; }
export interface GeneratePayrollPeriodSkippedItem { employeeId: string; employeeName: string; reason: string; }
export interface GeneratePayrollPeriodResponse {
  generatedCount: number;
  generated: PayrollLiquidationSummary[];
  skipped: GeneratePayrollPeriodSkippedItem[];
}
export interface GeneratePayrollPeriodRequest {
  periodicity: PayrollPeriodicity;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}
export interface PayLiquidationRequest { paymentMethod: PayrollPaymentMethod; cashSessionId: string | null; }

export interface SetEmployeePayrollConfigRequest { baseSalary: number | null; payrollPeriodicity: PayrollPeriodicity | null; }
export interface SetEmployeePayrollConfigResponse { employeeId: string; baseSalary: number | null; payrollPeriodicity: number | null; }
