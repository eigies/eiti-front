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

// La linea de tarjeta lleva la BASE (la parte de la venta que paga esa tarjeta): el recargo es base x % del
// plan y se cobra aparte, asi que con la base = lo que falta de la venta el saldo queda en cero.
describe('SalePaymentInlineComponent · tarjeta con recargo sobre su base', () => {
    let fixture: ComponentFixture<SalePaymentInlineComponent>;
    let state: SalePaymentDraftState;

    function setTotal(total: number): void {
        fixture.componentRef.setInput('total', total);
        fixture.detectChanges();
    }

    function chooseCard(index = 0): void {
        fixture.componentInstance.updatePaymentMethod(index, 3);
        fixture.componentInstance.updateCardBank(index, 1);
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
            { id: 1, name: 'Visa', active: true, useForCard: true, useForTransfer: false, useForCheque: false, plans: [{ id: 1, cuotas: 3, surchargePct: 10, active: true }] },
            { id: 2, name: 'MOURA', active: true, useForCard: true, useForTransfer: false, useForCheque: false, plans: [{ id: 2, cuotas: 3, surchargePct: 11.06, active: true }] }
        ]);
        fixture.detectChanges();
    });

    it('ejemplo del spec: $40.000 en efectivo + el resto con MOURA 3 cuotas 11,06 % no deja saldo', () => {
        const component = fixture.componentInstance;
        setTotal(100000);
        component.updatePaymentAmount(0, 40000);
        component.addPaymentLine();
        component.updatePaymentMethod(1, 3);
        component.updateCardBank(1, 2);

        expect(state.payments[1]).toEqual(jasmine.objectContaining({ amount: 60000, cardSurchargeAmt: 6636 }));
        expect(component.totalCardSurcharge).toBe(6636);
        expect(component.effectiveTotal).toBe(106636);
        expect(component.remaining).toBe(0);
        expect(component.getCardSurcharge(state.payments[1])).toEqual({ pct: 11.06, amt: 6636, total: 66636 });
    });

    it('muestra bajo la linea cuanto pasar por el posnet', () => {
        const component = fixture.componentInstance;
        setTotal(100000);
        component.updatePaymentAmount(0, 40000);
        component.addPaymentLine();
        component.updatePaymentMethod(1, 3);
        component.updateCardBank(1, 2);
        fixture.detectChanges();

        const text = (fixture.nativeElement.querySelector('.card-surcharge__total') as HTMLElement).textContent?.replace(/\s+/g, ' ').trim();
        expect(text).toBe('A pasar por el posnet: $66,636.00 (incluye recargo de $6,636.00)');
    });

    it('el resumen suma lo que pasa por el posnet en la linea de la tarjeta', () => {
        const component = fixture.componentInstance;
        setTotal(100000);
        component.updatePaymentAmount(0, 40000);
        component.addPaymentLine();
        component.updatePaymentMethod(1, 3);
        component.updateCardBank(1, 2);

        expect(component.coverageLines.map(line => line.amount)).toEqual([40000, 66636]);
    });

    it('cambiar la base recalcula el recargo', () => {
        setTotal(1000);
        chooseCard();

        fixture.componentInstance.updatePaymentAmount(0, 400);

        expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 400, cardSurchargeAmt: 40 }));
        expect(fixture.componentInstance.remaining).toBe(600);
    });

    describe('tarjeta elegida antes del total', () => {
        beforeEach(() => {
            fixture.componentInstance.updatePaymentMethod(0, 3);
            setTotal(1000);
            fixture.componentInstance.updateCardBank(0, 1);
        });

        it('la base se autocompleta con lo que falta de la venta y el recargo va aparte', () => {
            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 1000, cardSurchargeAmt: 100 }));
            expect(fixture.componentInstance.effectiveTotal).toBe(1100);
            expect(fixture.componentInstance.remaining).toBe(0);
        });

        it('si el total baja por un descuento, la base y el recargo bajan con él', () => {
            setTotal(900);

            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 900, cardSurchargeAmt: 90 }));
            expect(fixture.componentInstance.remaining).toBe(0);
        });

        it('una base cargada a mano no se pisa cuando cambia el total', () => {
            fixture.componentInstance.updatePaymentAmount(0, 500);

            setTotal(900);

            expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 500, cardSurchargeAmt: 50 }));
        });
    });

    it('si el importe venía del efectivo autocompletado, también sigue al total', () => {
        setTotal(1000);
        chooseCard();
        expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 1000, cardSurchargeAmt: 100 }));

        setTotal(900);

        expect(state.payments[0]).toEqual(jasmine.objectContaining({ amount: 900, cardSurchargeAmt: 90 }));
    });

    it('en un pago mixto, la tarjeta que cerraba la venta la sigue cerrando si cambia el total', () => {
        const component = fixture.componentInstance;
        setTotal(100000);
        component.updatePaymentAmount(0, 40000);
        component.addPaymentLine();
        component.updatePaymentMethod(1, 3);
        component.updateCardBank(1, 2);

        setTotal(90000);

        expect(state.payments[0].amount).toBe(40000);
        expect(state.payments[1]).toEqual(jasmine.objectContaining({ amount: 50000, cardSurchargeAmt: 5530 }));
        expect(component.remaining).toBe(0);
    });

    describe('una sola tarjeta por venta', () => {
        beforeEach(() => {
            setTotal(1000);
            chooseCard();
            fixture.componentInstance.updatePaymentAmount(0, 600);
            fixture.componentInstance.addPaymentLine();
        });

        it('la segunda linea no ofrece Tarjeta; la de la tarjeta si', () => {
            const component = fixture.componentInstance;

            expect(component.paymentMethodOptionsFor(1).map(o => o.label)).not.toContain('Tarjeta');
            expect(component.paymentMethodOptionsFor(0).map(o => o.label)).toContain('Tarjeta');
        });

        it('elegir Tarjeta en la segunda linea no la convierte en otra tarjeta', () => {
            fixture.componentInstance.updatePaymentMethod(1, 3);

            expect(state.payments.filter(p => p.idPaymentMethod === 3).length).toBe(1);
        });
    });
});
