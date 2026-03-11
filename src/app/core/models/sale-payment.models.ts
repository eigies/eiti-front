export interface SalePaymentRequest {
    idPaymentMethod: number;
    amount: number;
    notes?: string | null;
}

export interface SaleTradeInRequest {
    productId: string;
    quantity: number;
    amount: number;
}

export interface SalePaymentResponse extends SalePaymentRequest {
    paymentMethodName?: string | null;
}

export interface SaleTradeInResponse extends SaleTradeInRequest {
    productName?: string | null;
}

export interface SalePaymentDraftLine {
    idPaymentMethod: number;
    amount: number;
    notes: string;
}

export interface SaleTradeInDraftLine {
    productId: string;
    quantity: number;
    amount: number;
}

export interface SalePaymentDraftState {
    hasCombinedPayment: boolean;
    hasTradeIn: boolean;
    payments: SalePaymentDraftLine[];
    tradeIns: SaleTradeInDraftLine[];
}

export interface SalePaymentMethodOption {
    id: number;
    label: string;
    shortLabel: string;
}

export const SALE_STATUS_ON_HOLD = 1;
export const SALE_STATUS_PAID = 2;
export const SALE_PAYMENT_METHOD_CASH = 1;

export const SALE_PAYMENT_METHODS: SalePaymentMethodOption[] = [
    { id: 1, label: 'Efectivo', shortLabel: 'Cash' },
    { id: 2, label: 'Transferencia', shortLabel: 'Bank' },
    { id: 3, label: 'Tarjeta', shortLabel: 'Card' },
    { id: 4, label: 'Cheque', shortLabel: 'Check' },
    { id: 5, label: 'Otros', shortLabel: 'Other' }
];

export function createEmptySalePaymentDraftState(): SalePaymentDraftState {
    return {
        hasCombinedPayment: false,
        hasTradeIn: false,
        payments: [createEmptyPaymentLine()],
        tradeIns: []
    };
}

export function createEmptyPaymentLine(): SalePaymentDraftLine {
    return {
        idPaymentMethod: SALE_PAYMENT_METHOD_CASH,
        amount: 0,
        notes: ''
    };
}

export function createEmptyTradeInLine(): SaleTradeInDraftLine {
    return {
        productId: '',
        quantity: 1,
        amount: 0
    };
}

export function mapSalePaymentDraftState(
    payments?: SalePaymentResponse[] | null,
    tradeIns?: SaleTradeInResponse[] | null
): SalePaymentDraftState {
    const mappedPayments = (payments ?? [])
        .filter(item => Number(item.amount) > 0)
        .map(item => ({
            idPaymentMethod: Number(item.idPaymentMethod || SALE_PAYMENT_METHOD_CASH),
            amount: roundMoney(item.amount),
            notes: item.notes ?? ''
        }));
    const mappedTradeIns = (tradeIns ?? [])
        .filter(item => item.productId && Number(item.quantity) > 0 && Number(item.amount) > 0)
        .map(item => ({
            productId: item.productId,
            quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
            amount: roundMoney(item.amount)
        }));

    return {
        hasCombinedPayment: mappedPayments.length > 1,
        hasTradeIn: mappedTradeIns.length > 0,
        payments: mappedPayments.length > 0 ? mappedPayments : [createEmptyPaymentLine()],
        tradeIns: mappedTradeIns
    };
}

export function normalizeSalePayments(state: SalePaymentDraftState): SalePaymentRequest[] {
    return (state.payments ?? [])
        .map(item => ({
            idPaymentMethod: Number(item.idPaymentMethod || 0),
            amount: roundMoney(item.amount),
            notes: normalizeNotes(item.notes)
        }))
        .filter(item => item.idPaymentMethod > 0 && item.amount > 0);
}

export function normalizeSaleTradeIns(state: SalePaymentDraftState): SaleTradeInRequest[] {
    return (state.tradeIns ?? [])
        .map(item => ({
            productId: String(item.productId || ''),
            quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
            amount: roundMoney(item.amount)
        }))
        .filter(item => item.productId.length > 0 && item.quantity > 0 && item.amount > 0);
}

export function salePaymentCoverage(state: SalePaymentDraftState): number {
    return roundMoney(
        normalizeSalePayments(state).reduce((sum, item) => sum + item.amount, 0)
        + normalizeSaleTradeIns(state).reduce((sum, item) => sum + item.amount, 0)
    );
}

export function hasCashPayment(state: SalePaymentDraftState): boolean {
    return normalizeSalePayments(state)
        .some(item => item.idPaymentMethod === SALE_PAYMENT_METHOD_CASH && item.amount > 0);
}

export function paymentMethodSummary(
    payments?: Array<{ idPaymentMethod: number; amount: number; paymentMethodName?: string | null }> | null,
    tradeIns?: Array<Pick<SaleTradeInResponse, 'amount'>> | null
): string {
    const methodNames = [...new Set(
        (payments ?? [])
            .filter(item => Number(item.amount) > 0)
            .map(item => item.paymentMethodName?.trim() || SALE_PAYMENT_METHODS.find(method => method.id === Number(item.idPaymentMethod))?.label || 'Otros')
    )];

    if ((tradeIns ?? []).some(item => Number(item.amount) > 0)) {
        methodNames.push('Canje');
    }

    return methodNames.length > 0 ? methodNames.join(' + ') : 'Sin pagos';
}

export function roundMoney(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.round(parsed * 100) / 100;
}

function normalizeNotes(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
}
