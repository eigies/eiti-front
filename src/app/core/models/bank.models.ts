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
  useForCard: boolean;
  useForTransfer: boolean;
  useForCheque: boolean;
  plans: BankInstallmentPlanResponse[];
}

export type BankUsage = 'all' | 'card' | 'transfer' | 'cheque';

export interface BankUpsertRequest {
  name: string;
  active?: boolean;
  useForCard: boolean;
  useForTransfer: boolean;
  useForCheque: boolean;
}
