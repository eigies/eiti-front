export interface ChequeFormData {
    numero: string;
    bankId: number;
    titular: string;
    cuitDni: string;
    monto: number;
    fechaEmision: string;
    fechaVencimiento: string;
    notas?: string | null;
}

export interface SalePaymentRequest {
    idPaymentMethod: number;
    amount: number;
    reference?: string | null;
    cardBankId?: number | null;
    cardCuotas?: number | null;
    cardSurchargeAmt?: number | null;
    transferBankId?: number | null;
    cheque?: ChequeFormData | null;
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
    cardBankId?: number | null;
    cardCuotas?: number | null;
    cardSurchargePct?: number | null;
    cardSurchargeAmt?: number | null;
    transferBankId?: number | null;
    chequeData?: ChequeFormData | null;
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
    return { productId: '', quantity: 1, amount: 0 };
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
            notes: item.reference ?? '',
            cardBankId: item.cardBankId ?? null,
            cardCuotas: item.cardCuotas ?? null,
            cardSurchargeAmt: item.cardSurchargeAmt ?? null,
            transferBankId: item.transferBankId ?? null,
            chequeData: item.cheque ?? null
        }));
    const mappedTradeIns = (tradeIns ?? [])
        .filter(item => item.productId && Number(item.quantity) > 0)
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
            reference: normalizeNotes(item.notes),
            cardBankId: item.cardBankId ?? null,
            cardCuotas: item.cardCuotas ?? null,
            cardSurchargeAmt: item.cardSurchargeAmt ?? null,
            transferBankId: item.transferBankId ?? null,
            cheque: item.chequeData ?? null
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
        .filter(item => item.productId.length > 0 && item.quantity > 0 && item.amount >= 0);
}

/**
 * Lineas de canje con algo cargado que `normalizeSaleTradeIns` va a descartar: el usuario
 * escribio datos que no van a viajar con la venta.
 *
 * Una linea recien agregada y vacia no cuenta — no hay nada que perder.
 *
 * "Completa" tiene que significar exactamente lo mismo que acepta `normalizeSaleTradeIns`,
 * que es la puerta real hacia la API. Un canje en CERO es valido (el dominio solo rechaza
 * negativos y el validador pide GreaterThanOrEqualTo(0)), asi que no es pendiente: marcarlo
 * hacia imposible guardarlo, porque el unico camino que dejaba avanzar era descartar la linea.
 */
export function pendingTradeInLines(state: SalePaymentDraftState): SaleTradeInDraftLine[] {
    return (state.tradeIns ?? []).filter(item => {
        const quantity = Number(item.quantity);
        const amount = Number(item.amount);
        const hasData = Boolean(item.productId) || amount > 0 || quantity > 1;
        const isComplete = Boolean(item.productId)
            && Number.isFinite(quantity) && quantity >= 1
            && Number.isFinite(amount) && amount >= 0;

        return hasData && !isComplete;
    });
}

/**
 * Saca del estado las lineas que el usuario decidio no agregar. Sin esto el aviso vuelve a
 * salir en el paso siguiente, porque los datos incompletos siguen cargados.
 */
export function dropPendingTradeInLines(state: SalePaymentDraftState): void {
    const pending = new Set(pendingTradeInLines(state));
    state.tradeIns = (state.tradeIns ?? []).filter(line => !pending.has(line));
    state.hasTradeIn = state.tradeIns.length > 0;
}

/**
 * Texto de una linea de canje para mostrarla en el aviso: "MOURA 12x65 · 2 u · $85.000".
 * Los datos que faltan se nombran en vez de quedar vacios, que es justo lo que el usuario
 * tiene que ver para entender por que el canje no se agrego.
 */
export function describeTradeInLine(
    line: SaleTradeInDraftLine,
    products: readonly { id: string; brand?: string | null; name?: string | null }[]
): string {
    const product = products.find(item => item.id === line.productId);
    const label = product
        ? `${product.brand ?? ''} ${product.name ?? ''}`.trim() || 'Producto sin nombre'
        : 'Producto sin elegir';

    const quantity = Number(line.quantity);
    const units = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;

    const amount = Number(line.amount);
    const value = Number.isFinite(amount) && amount > 0
        ? amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
        : 'sin valor';

    return `${label} · ${units} u · ${value}`;
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
