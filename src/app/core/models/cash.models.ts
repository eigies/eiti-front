export interface CashDrawerResponse {
    id: string;
    branchId: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string | null;
    assignedUserId?: string | null;
    hasOpenSession?: boolean;
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
    saleCode?: string | null;
    createdByUsername?: string | null;
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
    paymentBreakdown: PaymentMethodBreakdownItem[];
}

export interface PaymentMethodBreakdownItem {
    method: number;
    methodName: string;
    amount: number;
}

export interface StaleCashSessionResponse {
    sessionId: string;
    cashDrawerId: string;
    openedAt: string;
    hoursOpen: number;
}

export interface CashSessionSummaryResponse {
    id: string;
    openingAmount: number;
    salesIncome: number;
    withdrawals: number;
    salesCancellations: number;
    expectedClosingAmount: number;
    actualClosingAmount?: number | null;
    difference: number;
}
