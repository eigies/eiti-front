import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaleDiscountControlComponent } from './sale-discount-control.component';
import { SaleDiscountDraft } from '../../sales-page-ui.models';

describe('SaleDiscountControlComponent', () => {
    let fixture: ComponentFixture<SaleDiscountControlComponent>;
    let emitted: SaleDiscountDraft[];

    function render(draft: SaleDiscountDraft, maxPercent = 10, subtotal = 1000, originalPercent: number | null = null): HTMLElement {
        fixture.componentRef.setInput('draft', draft);
        fixture.componentRef.setInput('maxPercent', maxPercent);
        fixture.componentRef.setInput('subtotal', subtotal);
        fixture.componentRef.setInput('originalPercent', originalPercent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    function text(): string {
        return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [SaleDiscountControlComponent] });
        fixture = TestBed.createComponent(SaleDiscountControlComponent);
        emitted = [];
        fixture.componentInstance.draftChange.subscribe(draft => emitted.push(draft));
    });

    it('cerrado muestra el botón con el máximo, sin los campos', () => {
        const element = render({ open: false, percent: 0, reason: '' });

        expect(text()).toContain('Descuento');
        expect(text()).toContain('hasta 10%');
        expect(element.querySelector('input')).toBeNull();
    });

    it('el botón despliega el % y el motivo', () => {
        const element = render({ open: false, percent: 0, reason: '' });

        (element.querySelector('button') as HTMLButtonElement).click();

        expect(emitted).toEqual([{ open: true, percent: 0, reason: '' }]);
    });

    it('el % escrito sale como número; lo que no es número es 0', () => {
        render({ open: true, percent: 0, reason: '' });

        fixture.componentInstance.setPercent('7.5');
        fixture.componentInstance.setPercent('abc');

        expect(emitted.map(draft => draft.percent)).toEqual([7.5, 0]);
    });

    it('el input del % tiene como máximo el tope', () => {
        const element = render({ open: true, percent: 5, reason: '' });

        const percentInput = element.querySelector('input[type="number"]') as HTMLInputElement;
        expect(percentInput.max).toBe('10');
    });

    it('muestra cuánto se descuenta', () => {
        render({ open: true, percent: 10, reason: '' });

        expect(text()).toContain('$100.00');
    });

    it('por encima del tope avisa', () => {
        render({ open: true, percent: 15, reason: '' });

        expect(text()).toContain('El descuento supera el máximo de 10% que fijó el dueño.');
    });

    it('un descuento que la venta ya tenía no se vuelve a validar contra el tope', () => {
        render({ open: true, percent: 15, reason: '' }, 10, 1000, 15);

        expect(text()).not.toContain('supera el máximo');
    });

    it('el motivo no pasa de 200 caracteres', () => {
        const element = render({ open: true, percent: 5, reason: '' });

        const reasonInput = element.querySelector('input[type="text"]') as HTMLInputElement;
        expect(reasonInput.maxLength).toBe(200);
    });
});
