import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { SaleResponse } from '../../../../core/models/sale.models';
import { SaleActionsMenuComponent } from './sale-actions-menu.component';

describe('SaleActionsMenuComponent', () => {
    let fixture: ComponentFixture<SaleActionsMenuComponent>;
    let component: SaleActionsMenuComponent;
    let pendingSale: SaleResponse;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [SaleActionsMenuComponent, RouterTestingModule]
        });

        fixture = TestBed.createComponent(SaleActionsMenuComponent);
        component = fixture.componentInstance;
        pendingSale = {
            id: 'sale-1',
            code: 'V-0001',
            branchId: 'branch-1',
            hasDelivery: true,
            idSaleStatus: 1,
            saleStatus: 'En espera',
            totalAmount: 100,
            createdAt: '2026-07-02T10:00:00Z',
            isModified: false,
            isCuentaCorriente: false,
            details: []
        };
        fixture.componentRef.setInput('sale', pendingSale);
    });

    it('shows cobrar, WhatsApp, documents and more for an eligible pending sale', () => {
        fixture.componentRef.setInput('canPay', true);
        fixture.componentRef.setInput('canSendWhatsApp', true);

        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-action="pay"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-action="whatsapp"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-menu="documents"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-menu="more"]')).not.toBeNull();
    });

    it('emits semantic actions', () => {
        spyOn(component.action, 'emit');

        component.emitAction('edit');

        expect(component.action.emit).toHaveBeenCalledWith('edit');
    });

    it('hides permission-gated actions', () => {
        fixture.componentRef.setInput('canPay', false);
        fixture.componentRef.setInput('canEdit', false);
        component.moreOpen = true;

        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-action="pay"]')).toBeNull();
        expect(fixture.nativeElement.textContent).not.toContain('Editar venta');
    });

    it('keeps a stable WhatsApp slot when the action is unavailable', () => {
        fixture.componentRef.setInput('canSendWhatsApp', false);
        fixture.detectChanges();

        const slot = fixture.nativeElement.querySelector('[data-slot="whatsapp"]');
        expect(slot).not.toBeNull();
        if (!slot) return;
        expect(slot.classList).toContain('is-empty');
        expect(slot.querySelector('[data-action="whatsapp"]')).toBeNull();
    });

    it('uses the official WhatsApp asset when the action is available', () => {
        fixture.componentRef.setInput('canSendWhatsApp', true);
        fixture.detectChanges();

        const icon = fixture.nativeElement.querySelector('[data-action="whatsapp"] img');
        expect(icon).not.toBeNull();
        if (!icon) return;
        expect(icon.getAttribute('src')).toBe('assets/channels/ch-whatsapp.svg');
    });

    it('anchors popovers to the full action bar instead of the icon button', () => {
        fixture.detectChanges();

        const actions = fixture.nativeElement.querySelector('.sale-actions') as HTMLElement;
        const menuWrap = fixture.nativeElement.querySelector('.sale-actions__menu-wrap') as HTMLElement;

        expect(getComputedStyle(actions).position).toBe('relative');
        expect(getComputedStyle(menuWrap).position).toBe('static');
    });
});
