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
});
