import { ComponentFixture, TestBed } from '@angular/core/testing';
import { createEmptySalePaymentDraftState } from '../../../core/models/sale-payment.models';
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
