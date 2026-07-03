import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SalesManagementComponent } from './sales-management.component';

describe('SalesManagementComponent', () => {
    let fixture: ComponentFixture<SalesManagementComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [SalesManagementComponent]
        });
        fixture = TestBed.createComponent(SalesManagementComponent);
    });

    it('exposes the management workspace as a labelled region', () => {
        fixture.detectChanges();

        const region = fixture.nativeElement.querySelector('[role="region"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-label')).toBe('Gestión de ventas');
    });
});
