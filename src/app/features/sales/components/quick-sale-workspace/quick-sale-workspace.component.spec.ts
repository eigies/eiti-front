import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickSaleWorkspaceComponent } from './quick-sale-workspace.component';

describe('QuickSaleWorkspaceComponent', () => {
    let fixture: ComponentFixture<QuickSaleWorkspaceComponent>;
    let component: QuickSaleWorkspaceComponent;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [QuickSaleWorkspaceComponent]
        });

        fixture = TestBed.createComponent(QuickSaleWorkspaceComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('activeStage', 'config');
    });

    it('emits the selected stage', () => {
        const emitted: string[] = [];
        component.stageChange.subscribe(value => emitted.push(value));

        component.selectStage('products');

        expect(emitted).toEqual(['products']);
    });

    it('marks completed and active stages accessibly', () => {
        fixture.componentRef.setInput('activeStage', 'products');
        fixture.componentRef.setInput('configComplete', true);
        fixture.detectChanges();

        const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
        expect(tabs[0].textContent).toContain('Datos de venta');
        expect(tabs[0].classList).toContain('is-complete');
        expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    });
});
