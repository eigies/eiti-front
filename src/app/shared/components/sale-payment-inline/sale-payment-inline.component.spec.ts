import { ComponentFixture, TestBed } from '@angular/core/testing';
import { createEmptySalePaymentDraftState, SalePaymentDraftState } from '../../../core/models/sale-payment.models';
import { SalePaymentInlineComponent } from './sale-payment-inline.component';

describe('SalePaymentInlineComponent layout', () => {
    let fixture: ComponentFixture<SalePaymentInlineComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [SalePaymentInlineComponent]
        });

        fixture = TestBed.createComponent(SalePaymentInlineComponent);
        fixture.componentRef.setInput('total', 0);
        fixture.componentRef.setInput('statusId', 1);
        fixture.componentRef.setInput('products', []);
        fixture.componentRef.setInput('cashDrawers', []);
        fixture.componentRef.setInput('state', createEmptySalePaymentDraftState());
    });

    it('establishes inline-size containment for nested responsive layout', () => {
        fixture.detectChanges();

        const block = fixture.nativeElement.querySelector('.payment-block') as HTMLElement;

        expect(getComputedStyle(block).containerType).toBe('inline-size');
    });

    it('filters bank options by payment capability', () => {
        fixture.componentInstance.banks = [
            { id: 1, name: 'Card Bank', active: true, useForCard: true, useForTransfer: false, useForCheque: false, plans: [{ id: 1, cuotas: 1, surchargePct: 0, active: true }] },
            { id: 2, name: 'Transfer Bank', active: true, useForCard: false, useForTransfer: true, useForCheque: false, plans: [] },
            { id: 3, name: 'Cheque Bank', active: true, useForCard: false, useForTransfer: false, useForCheque: true, plans: [] }
        ];

        expect(fixture.componentInstance.activeBanksWithPlansOptions.map(o => o.label)).toEqual(['Card Bank']);
        expect(fixture.componentInstance.activeBanksOptions.map(o => o.label)).toEqual(['Transfer Bank']);
        expect(fixture.componentInstance.bankOptions.map(o => o.label)).toEqual(['Cheque Bank']);
    });
});

// El recargo de tarjeta va sobre el total de la venta: si el total cambia despues de elegir la tarjeta
// (un descuento, un producto mas), el recargo y el importe autocompletado lo tienen que seguir.
describe('SalePaymentInlineComponent · tarjeta cuando cambia el total', () => {
    let fixture: ComponentFixture<SalePaymentInlineComponent>;
    let state: SalePaymentDraftState;

    function setTotal(total: number): void {
        fixture.componentRef.setInput('total', total);
        fixture.detectChanges();
    }

    function chooseCard(): void {
        fixture.componentInstance.updatePaymentMethod(0, 3);
        fixture.componentInstance.updateCardBank(0, 1);
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [SalePaymentInlineComponent] });
        fixture = TestBed.createComponent(SalePaymentInlineComponent);
        state = createEmptySalePaymentDraftState();
        // Como en el alta: el cobro arranca con la venta vacia y el total crece al cargar productos.
        fixture.componentRef.setInput('total', 0);
        fixture.componentRef.setInput('statusId', 2);
        fixture.componentRef.setInput('products', []);
        fixture.componentRef.setInput('cashDrawers', []);
        fixture.componentRef.setInput('state', state);
        fixture.componentRef.setInput('banks', [
            { id: 1, name: 'Visa', active: true, useForCard: true, useForTransfer: false, useForCheque: false, plans: [{ id: 1, cuotas: 3, surchargePct: 10, active: true }] }
        ]);
        fixture.detectChanges();
    });

    describe('tarjeta elegida con el total ya cargado', () => {
        beforeEach(() => {
            fixture.componentInstance.updatePaymentMethod(0, 3);
            setTotal(1000);
            fixture.componentInstance.updateCardBank(0, 1);
        });

        it('al elegir la tarjeta el importe es el total con recargo', () => {
            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 1100, cardSurchargeAmt: 100 }));
        });

        it('si el total baja por un descuento, el recargo y el importe bajan con él', () => {
            setTotal(900);

            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 990, cardSurchargeAmt: 90 }));
            expect(fixture.componentInstance.remaining).toBe(0);
        });

        it('un importe de tarjeta cargado a mano no se pisa, pero el recargo sí se recalcula', () => {
            fixture.componentInstance.updatePaymentAmount(0, 500);

            setTotal(900);

            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 500, cardSurchargeAmt: 90 }));
        });
    });

    it('si el importe venía del efectivo autocompletado, también sigue al total', () => {
        setTotal(1000);
        chooseCard();
        expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 1000, cardSurchargeAmt: 100 }));

        setTotal(900);

        expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 990, cardSurchargeAmt: 90 }));
    });
});
