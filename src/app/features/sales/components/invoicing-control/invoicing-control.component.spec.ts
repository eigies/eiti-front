import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InvoicingControlComponent } from './invoicing-control.component';

describe('InvoicingControlComponent', () => {
  let fixture: ComponentFixture<InvoicingControlComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InvoicingControlComponent] });
    fixture = TestBed.createComponent(InvoicingControlComponent);
  });

  function render(inputs: Partial<InvoicingControlComponent>): HTMLElement {
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('avisa que la sucursal no tiene punto de venta en lugar de ofrecer la letra', () => {
    const element = render({ willInvoice: true, missingPointOfSale: true });

    expect(element.querySelector('.invoicing-control__warn')?.textContent).toContain('Sucursal sin punto de venta');
    expect(element.querySelector('app-invoice-letter-switch')).toBeNull();
  });

  it('sin pedir factura no avisa nada', () => {
    const element = render({ willInvoice: false, missingPointOfSale: true });

    expect(element.querySelector('.invoicing-control__warn')).toBeNull();
  });

  it('con punto de venta muestra la letra', () => {
    const element = render({ willInvoice: true, missingPointOfSale: false });

    expect(element.querySelector('app-invoice-letter-switch')).not.toBeNull();
  });
});
