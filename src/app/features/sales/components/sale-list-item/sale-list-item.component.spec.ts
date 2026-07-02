import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaleListItemComponent } from './sale-list-item.component';

describe('SaleListItemComponent', () => {
    let fixture: ComponentFixture<SaleListItemComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [SaleListItemComponent]
        });
        fixture = TestBed.createComponent(SaleListItemComponent);
    });

    it('reflects expanded state on the host row', () => {
        fixture.componentRef.setInput('expanded', true);
        fixture.detectChanges();

        expect(fixture.nativeElement.getAttribute('role')).toBe('row');
        expect(fixture.nativeElement.getAttribute('aria-expanded')).toBe('true');
    });
});
