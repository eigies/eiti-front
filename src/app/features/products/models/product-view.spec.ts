import { FormBuilder } from '@angular/forms';
import { buildProductForm, toProductRequest } from './product-form';
import { bulkFieldChanged } from './product-view';

describe('bulkFieldChanged', () => {
  function setup() {
    const form = buildProductForm(new FormBuilder());
    form.patchValue({ code: 'A-1', sku: 'A-1', brand: 'Marca', name: 'Producto', publicPrice: 100, price: 100, costPrice: 50, allowsManualSaleValue: false });
    const snapshot = toProductRequest(form, true);
    return { form, snapshot };
  }

  it('marca la celda Tipo cuando cambia "valor en venta"', () => {
    const { form, snapshot } = setup();
    expect(bulkFieldChanged(form, snapshot, 'allowsManualSaleValue', true)).toBeFalse();

    form.patchValue({ allowsManualSaleValue: true });

    expect(bulkFieldChanged(form, snapshot, 'allowsManualSaleValue', true)).toBeTrue();
  });

  it('no marca otras celdas que no cambiaron', () => {
    const { form, snapshot } = setup();
    form.patchValue({ allowsManualSaleValue: true });

    expect(bulkFieldChanged(form, snapshot, 'brand', true)).toBeFalse();
  });
});
