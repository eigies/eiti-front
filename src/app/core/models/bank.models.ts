export interface BankInstallmentPlanResponse {
  id: number;
  cuotas: number;
  surchargePct: number;
  active: boolean;
}

export interface BankResponse {
  id: number;
  name: string;
  active: boolean;
  plans: BankInstallmentPlanResponse[];
}
