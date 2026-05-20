import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CashDrawerResponse } from '../../../core/models/cash.models';
import { ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../../core/models/product.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../searchable-select/searchable-select.component';
import {
    SalePaymentDraftLine,
    SalePaymentDraftState,
    SALE_PAYMENT_METHODS,
    SALE_STATUS_PAID,
    createEmptyPaymentLine,
    createEmptyTradeInLine,
    hasCashPayment,
    normalizeSalePayments,
    normalizeSaleTradeIns,
    roundMoney
} from '../../../core/models/sale-payment.models';
import { BankInstallmentPlanResponse, BankResponse } from '../../../core/models/bank.models';

@Component({
    selector: 'app-sale-payment-inline',
    standalone: true,
    imports: [CommonModule, FormsModule, SearchableSelectComponent],
    templateUrl: './sale-payment-inline.component.html',
    styleUrls: ['./sale-payment-inline.component.css']
})
export class SalePaymentInlineComponent implements OnChanges {
    @Input({ required: true }) total = 0;
    @Input({ required: true }) statusId = 1;
    @Input({ required: true }) products: ProductResponse[] = [];
    @Input({ required: true }) cashDrawers: CashDrawerResponse[] = [];
    @Input({ required: true }) state!: SalePaymentDraftState;
    @Input() cashDrawerId: string | null = null;
    @Input() headline = 'Cobro integrado';
    @Input() description = 'Configura pagos y canje dentro de la misma venta.';
    @Input() compact = false;
    @Input() autoSurcharge = 0;
    @Input() showTradeIn = true;
    @Input() banks: BankResponse[] = [];
    @Output() cashDrawerIdChange = new EventEmitter<string | null>();

    readonly paymentMethods = SALE_PAYMENT_METHODS;
    readonly paidStatusId = SALE_STATUS_PAID;
    readonly TRANSFER_METHOD_ID = 2;
    readonly CARD_METHOD_ID = 3;
    readonly CHECK_METHOD_ID = 4;

    get paymentMethodOptions(): SearchableSelectOption[] {
        return this.paymentMethods.map(method => ({
            value: method.id,
            label: method.label
        }));
    }

    get activeBanksOptions(): SearchableSelectOption[] {
        return this.activeBanks.map(bank => ({
            value: bank.id,
            label: bank.name
        }));
    }

    get activeBanksWithPlansOptions(): SearchableSelectOption[] {
        return this.activeBanksWithPlans.map(bank => ({
            value: bank.id,
            label: bank.name
        }));
    }

    get bankOptions(): SearchableSelectOption[] {
        return this.banks.map(bank => ({
            value: bank.id,
            label: bank.name
        }));
    }

    get tradeInProductOptions(): SearchableSelectOption[] {
        return this.products.map(product => ({
            value: product.id,
            label: `${product.code} | ${product.brand} / ${product.name}`,
            meta: this.isManualValueTradeIn(product.id) ? 'Valor definido en venta' : undefined,
            searchText: `${product.code} ${product.brand} ${product.name}`
        }));
    }

    get cashDrawerOptions(): SearchableSelectOption[] {
        return this.cashDrawers.map(drawer => ({
            value: drawer.id,
            label: drawer.name
        }));
    }

    get coverage(): number {
        const payments = this.state.payments
            .filter(p => p.idPaymentMethod > 0 && p.amount > 0)
            .reduce((sum, p) => sum + p.amount, 0);
        const tradeIns = normalizeSaleTradeIns(this.state)
            .reduce((sum, t) => sum + t.amount, 0);
        return roundMoney(payments + tradeIns);
    }

    get totalCardSurcharge(): number {
        // Surcharge is fixed on the SALE TOTAL, not on the card payment amount.
        // Find the first card payment with a bank+cuotas selection and apply its rate to this.total.
        for (const p of this.state.payments) {
            if (p.idPaymentMethod === this.CARD_METHOD_ID && p.cardBankId != null && p.cardCuotas != null) {
                const pct = this.getSurchargePct(p.cardBankId, p.cardCuotas);
                if (pct != null && pct > 0) return roundMoney(this.total * pct / 100);
            }
        }
        return 0;
    }

    get effectiveTotal(): number {
        return roundMoney(this.total + this.totalCardSurcharge);
    }

    get remaining(): number {
        return roundMoney(this.effectiveTotal - this.coverage);
    }

    get requiresCashDrawer(): boolean {
        return this.cashDrawers.length > 1;
    }

    get normalizedPaymentsCount(): number {
        return normalizeSalePayments(this.state).length;
    }

    get normalizedTradeInsCount(): number {
        return normalizeSaleTradeIns(this.state).length;
    }

    get coverageLines(): Array<{ label: string; amount: number; type: 'payment' | 'tradein' }> {
        const payments = this.state.payments
            .filter(p => p.idPaymentMethod > 0 && p.amount > 0)
            .map(p => ({
                label: this.paymentMethodLabel(p.idPaymentMethod),
                amount: p.amount,
                type: 'payment' as const
            }));
        const tradeIns = normalizeSaleTradeIns(this.state).map(t => ({
            label: this.tradeInProductName(t.productId),
            amount: t.amount,
            type: 'tradein' as const
        }));
        return [...payments, ...tradeIns];
    }

    toggleCombinedPayment(checked: boolean): void {
        this.state.hasCombinedPayment = checked;

        if (!checked && this.state.payments.length > 1) {
            this.state.payments = [this.state.payments[0]];
        } else if (checked && this.state.payments.length === 1) {
            this.state.payments = [...this.state.payments, createEmptyPaymentLine()];
        }
    }

    toggleTradeIn(checked: boolean): void {
        this.state.hasTradeIn = checked;

        if (!checked) {
            this.state.tradeIns = [];
            return;
        }

        if (this.state.tradeIns.length === 0) {
            this.state.tradeIns = [createEmptyTradeInLine()];
        }
    }

    addPaymentLine(): void {
        this.state.hasCombinedPayment = true;
        this.state.payments = [...this.state.payments, createEmptyPaymentLine()];
    }

    removePaymentLine(index: number): void {
        if (this.state.payments.length === 1) {
            this.state.payments = [createEmptyPaymentLine()];
            return;
        }

        this.state.payments = this.state.payments.filter((_, itemIndex) => itemIndex !== index);
        this.state.hasCombinedPayment = this.state.payments.length > 1;
    }

    addTradeInLine(): void {
        this.state.hasTradeIn = true;
        this.state.tradeIns = [...this.state.tradeIns, createEmptyTradeInLine()];
    }

    removeTradeInLine(index: number): void {
        this.state.tradeIns = this.state.tradeIns.filter((_, itemIndex) => itemIndex !== index);
        this.state.hasTradeIn = this.state.tradeIns.length > 0;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['total']) return;
        for (const payment of this.state?.payments ?? []) {
            if (payment.idPaymentMethod !== this.CARD_METHOD_ID && payment.amount === 0 && this.remaining > 0) {
                payment.amount = this.remaining;
                break;
            }
        }
    }

    updatePaymentMethod(index: number, value: string | number | null): void {
        const next = Number(value) || 1;
        this.state.payments[index].idPaymentMethod = next;

        // Auto-fill amount for non-card methods (card waits for bank+cuotas selection)
        if (next !== this.CARD_METHOD_ID && this.state.payments[index].amount === 0 && this.remaining > 0) {
            this.state.payments[index].amount = this.remaining;
        }
    }

    updatePaymentAmount(index: number, value: string | number): void {
        this.state.payments[index].amount = roundMoney(value);
        if (this.state.payments[index].chequeData) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.state.payments[index].chequeData!.monto = this.state.payments[index].amount;
        }
        this.recalculateSurcharge(index);
    }

    updatePaymentNotes(index: number, value: string): void {
        this.state.payments[index].notes = value;
    }

    updateTradeInProduct(index: number, value: string | number | null): void {
        const nextValue = String(value ?? '');
        this.state.tradeIns[index].productId = nextValue;

        const product = this.products.find(item => item.id === nextValue);
        if (!product) {
            return;
        }

        if (productAllowsManualSaleValue(product)) {
            this.state.tradeIns[index].amount = 0;
            return;
        }

        if (this.state.tradeIns[index].amount <= 0) {
            this.state.tradeIns[index].amount = roundMoney(productPublicPrice(product) * this.state.tradeIns[index].quantity);
        }
    }

    updateTradeInQuantity(index: number, value: string): void {
        const parsed = Math.floor(Number(value) || 0);
        this.state.tradeIns[index].quantity = parsed > 0 ? parsed : 1;

        const product = this.products.find(item => item.id === this.state.tradeIns[index].productId);
        if (product && !productAllowsManualSaleValue(product) && this.state.tradeIns[index].amount <= 0) {
            this.state.tradeIns[index].amount = roundMoney(productPublicPrice(product) * this.state.tradeIns[index].quantity);
        }
    }

    updateTradeInAmount(index: number, value: string): void {
        this.state.tradeIns[index].amount = roundMoney(value);
    }

    selectCashDrawer(value: string | number | null): void {
        const nextValue = String(value ?? '');
        this.cashDrawerIdChange.emit(nextValue || null);
    }

    paymentMethodLabel(idPaymentMethod: number): string {
        return this.paymentMethods.find(item => item.id === idPaymentMethod)?.label ?? 'Metodo';
    }

    tradeInProductName(productId: string): string {
        if (!productId) {
            return 'Producto a reconocer';
        }

        const product = this.products.find(item => item.id === productId);
        return product ? `${product.brand} / ${product.name}` : 'Producto no encontrado';
    }

    isManualValueTradeIn(productId: string): boolean {
        const product = this.products.find(item => item.id === productId);
        return !!product && productAllowsManualSaleValue(product);
    }

    tradeInAmountHint(productId: string, quantity: number): string {
        const product = this.products.find(item => item.id === productId);
        if (!product) {
            return 'Selecciona un producto para cargar el valor reconocido.';
        }

        if (productAllowsManualSaleValue(product)) {
            return 'Valor definido en venta: este producto se identifica para canje y el monto se ingresa manualmente en la operacion.';
        }

        return `Referencia maestro: ${roundMoney(productPublicPrice(product) * Math.max(1, quantity))}`;
    }

    roundMoney(value: number | string | null | undefined): number {
        return roundMoney(value);
    }

    get activeBanks(): BankResponse[] {
        return this.banks.filter(b => b.active);
    }

    get activeBanksWithPlans(): BankResponse[] {
        return this.banks.filter(b => b.active && b.plans.some(p => p.active));
    }

    activePlansForBank(bankId: number | null | undefined): BankInstallmentPlanResponse[] {
        if (!bankId) return [];
        const bank = this.banks.find(b => b.id === bankId);
        return (bank?.plans ?? []).filter(p => p.active);
    }

    installmentOptions(bankId: number | null | undefined): SearchableSelectOption[] {
        return this.activePlansForBank(bankId).map(plan => ({
            value: plan.cuotas,
            label: `${plan.cuotas} cuota${plan.cuotas > 1 ? 's' : ''}`,
            meta: plan.surchargePct > 0 ? `Recargo ${plan.surchargePct}%` : 'Sin recargo'
        }));
    }

    getSurchargePct(bankId: number | null | undefined, cuotas: number | null | undefined): number | null {
        if (!bankId || !cuotas) return null;
        const bank = this.banks.find(b => Number(b.id) === Number(bankId));
        const plan = bank?.plans.find(p => Number(p.cuotas) === Number(cuotas) && p.active);
        return plan?.surchargePct ?? null;
    }

    getSurchargeAmt(amount: number, surchargePct: number | null): number {
        if (surchargePct == null || surchargePct === 0) return 0;
        // amount already includes surcharge; back-compute the surcharge portion
        return roundMoney(amount * surchargePct / (100 + surchargePct));
    }

    getCardSurcharge(payment: SalePaymentDraftLine): { pct: number; amt: number; total: number } | null {
        const pct = this.getSurchargePct(payment.cardBankId, payment.cardCuotas);
        if (pct == null) return null;
        const amt = roundMoney(this.total * pct / 100);
        return { pct, amt, total: roundMoney(this.total + amt) };
    }

    updateTransferBank(index: number, value: number | null): void {
        this.state.payments = this.state.payments.map((item, i) =>
            i === index ? { ...item, transferBankId: value ?? null } : item
        );
    }

    updateCardBank(index: number, value: number | null): void {
        const p = this.state.payments[index];
        this.state.payments = this.state.payments.map((item, i) =>
            i === index ? { ...p, cardBankId: value ?? null, cardCuotas: null, cardSurchargePct: null, cardSurchargeAmt: null } : item
        );
        // Auto-select cuotas when the bank has exactly one active plan
        const plans = value != null ? this.activePlansForBank(value) : [];
        if (plans.length === 1) {
            this.updateCardCuotas(index, plans[0].cuotas);
        } else {
            this.recalculateSurcharge(index);
        }
    }

    updateCardCuotas(index: number, value: number | null): void {
        const p = this.state.payments[index];
        let amount = p.amount;

        if (amount === 0 && value != null) {
            const pct = this.getSurchargePct(p.cardBankId, value);
            if (pct != null) {
                // New effectiveTotal = total + fixed surcharge on total
                const newSurcharge = roundMoney(this.total * pct / 100);
                const newEffectiveTotal = roundMoney(this.total + newSurcharge);
                // Coverage from OTHER payments (exclude this one which has amount=0)
                const otherCoverage = roundMoney(this.coverage - p.amount);
                const rem = roundMoney(newEffectiveTotal - otherCoverage);
                if (rem > 0) {
                    amount = rem;
                }
            }
        }

        this.state.payments = this.state.payments.map((item, i) =>
            i === index ? { ...p, cardCuotas: value ?? null, amount } : item
        );
        this.recalculateSurcharge(index);
    }

    private recalculateSurcharge(index: number): void {
        const payment = this.state.payments[index];
        const surchargePct = this.getSurchargePct(payment.cardBankId, payment.cardCuotas);
        // Surcharge is fixed on the sale total, not on the individual payment amount
        const cardSurchargeAmt = surchargePct != null && surchargePct > 0
            ? roundMoney(this.total * surchargePct / 100)
            : null;
        this.state.payments = this.state.payments.map((item, i) =>
            i === index ? { ...item, cardSurchargePct: surchargePct, cardSurchargeAmt } : item
        );
    }

    toggleChequeForm(index: number): void {
        if (this.state.payments[index].chequeData) {
            this.state.payments[index].chequeData = null;
        } else {
            this.state.payments[index].chequeData = {
                numero: '',
                bankId: 0,
                titular: '',
                cuitDni: '',
                monto: this.state.payments[index].amount,
                fechaEmision: this.todayIso(),
                fechaVencimiento: this.todayIso(),
                notas: ''
            };
        }
    }

    isChequeFormComplete(index: number): boolean {
        const d = this.state.payments[index].chequeData;
        if (!d) return false;
        return !!(d.numero?.trim() && d.bankId > 0 && d.titular?.trim() && d.cuitDni?.trim() && d.monto > 0 && d.fechaEmision && d.fechaVencimiento);
    }

    private todayIso(): string {
        return new Date().toISOString().slice(0, 10);
    }

    trackByIndex(index: number): number {
        return index;
    }
}
