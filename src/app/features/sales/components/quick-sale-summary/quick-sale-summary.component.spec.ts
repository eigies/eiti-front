import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickSaleSummaryComponent } from './quick-sale-summary.component';

describe('QuickSaleSummaryComponent', () => {
    let fixture: ComponentFixture<QuickSaleSummaryComponent>;
    let component: QuickSaleSummaryComponent;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [QuickSaleSummaryComponent]
        });

        fixture = TestBed.createComponent(QuickSaleSummaryComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('activeStage', 'config');
    });

    it('uses the correct action label for each stage', () => {
        fixture.componentRef.setInput('activeStage', 'products');
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.quick-summary__action').textContent)
            .toContain('Continuar al cobro');
    });

    it('emits the primary action', () => {
        spyOn(component.primaryAction, 'emit');

        component.handlePrimaryAction();

        expect(component.primaryAction.emit).toHaveBeenCalled();
    });

    it('shows at most three product rows and the remaining count', () => {
        fixture.componentRef.setInput('items', [
            { id: '1', label: 'Producto 1', quantity: 1, subtotal: 10 },
            { id: '2', label: 'Producto 2', quantity: 2, subtotal: 20 },
            { id: '3', label: 'Producto 3', quantity: 3, subtotal: 30 },
            { id: '4', label: 'Producto 4', quantity: 4, subtotal: 40 },
            { id: '5', label: 'Producto 5', quantity: 5, subtotal: 50 }
        ]);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('.quick-summary__product').length).toBe(3);
        expect(fixture.nativeElement.querySelector('.quick-summary__more').textContent)
            .toContain('+ 2 productos más');
    });

    it('emits when the user requests the remaining products', () => {
        spyOn(component.productsRequested, 'emit');

        component.requestProducts();

        expect(component.productsRequested.emit).toHaveBeenCalled();
    });
});
