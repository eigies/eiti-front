import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CashDrawerResponse } from '../../../core/models/cash.models';
import { ProductResponse } from '../../../core/models/product.models';
import {
    SalePaymentDraftState,
    SALE_PAYMENT_METHODS,
    SALE_STATUS_PAID,
    createEmptyPaymentLine,
    createEmptyTradeInLine,
    hasCashPayment,
    normalizeSalePayments,
    normalizeSaleTradeIns,
    roundMoney,
    salePaymentCoverage
} from '../../../core/models/sale-payment.models';

@Component({
    selector: 'app-sale-payment-inline',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './sale-payment-inline.component.html',
    styleUrls: ['./sale-payment-inline.component.css']
})
export class SalePaymentInlineComponent {
    @Input({ required: true }) total = 0;
    @Input({ required: true }) statusId = 1;
    @Input({ required: true }) products: ProductResponse[] = [];
    @Input({ required: true }) cashDrawers: CashDrawerResponse[] = [];
    @Input({ required: true }) state!: SalePaymentDraftState;
    @Input() cashDrawerId: string | null = null;
    @Input() headline = 'Cobro integrado';
    @Input() description = 'Configura pagos y canje dentro de la misma venta.';
    @Input() compact = false;
    @Output() cashDrawerIdChange = new EventEmitter<string | null>();

    readonly paymentMethods = SALE_PAYMENT_METHODS;
    readonly paidStatusId = SALE_STATUS_PAID;

    get coverage(): number {
        return salePaymentCoverage(this.state);
    }

    get remaining(): number {
        return roundMoney(this.total - this.coverage);
    }

    get requiresCashDrawer(): boolean {
        return this.statusId === SALE_STATUS_PAID && hasCashPayment(this.state);
    }

    get normalizedPaymentsCount(): number {
        return normalizeSalePayments(this.state).length;
    }

    get normalizedTradeInsCount(): number {
        return normalizeSaleTradeIns(this.state).length;
    }

    toggleCombinedPayment(checked: boolean): void {
        this.state.hasCombinedPayment = checked;

        if (!checked && this.state.payments.length > 1) {
            this.state.payments = [this.state.payments[0]];
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

    updatePaymentMethod(index: number, value: string): void {
        const next = Number(value) || 1;
        this.state.payments[index].idPaymentMethod = next;
    }

    updatePaymentAmount(index: number, value: string): void {
        this.state.payments[index].amount = roundMoney(value);
    }

    updatePaymentNotes(index: number, value: string): void {
        this.state.payments[index].notes = value;
    }

    updateTradeInProduct(index: number, value: string): void {
        this.state.tradeIns[index].productId = value;
    }

    updateTradeInQuantity(index: number, value: string): void {
        const parsed = Math.floor(Number(value) || 0);
        this.state.tradeIns[index].quantity = parsed > 0 ? parsed : 1;
    }

    updateTradeInAmount(index: number, value: string): void {
        this.state.tradeIns[index].amount = roundMoney(value);
    }

    selectCashDrawer(value: string): void {
        this.cashDrawerIdChange.emit(value || null);
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

    trackByIndex(index: number): number {
        return index;
    }
}
