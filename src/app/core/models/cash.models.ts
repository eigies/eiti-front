export interface CashDrawerResponse {
    id: string;
    branchId: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CashSessionMovementResponse {
    id: string;
    type: number;
    typeName: string;
    direction: number;
    directionName: string;
    amount: number;
    occurredAt: string;
    description: string;
    referenceType?: string | null;
    referenceId?: string | null;
}

export interface CashSessionResponse {
    id: string;
    branchId: string;
    cashDrawerId: string;
    status: number;
    statusName: string;
    openedAt: string;
    closedAt?: string | null;
    openingAmount: number;
    expectedClosingAmount: number;
    actualClosingAmount?: number | null;
    difference: number;
    notes?: string | null;
    movements: CashSessionMovementResponse[];
}

export interface CashSessionSummaryResponse {
    id: string;
    openingAmount: number;
    salesIncome: number;
    withdrawals: number;
    expectedClosingAmount: number;
    actualClosingAmount?: number | null;
    difference: number;
}
