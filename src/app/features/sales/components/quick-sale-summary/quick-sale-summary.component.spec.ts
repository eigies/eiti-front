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
});
