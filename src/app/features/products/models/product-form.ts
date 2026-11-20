import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductResponse, productAllowsManualSaleValue } from '../../../core/models/product.models';

/**
 * Reglas del formulario de producto (alta, edición y edición masiva).
 * Movidas tal cual desde ProductsComponent: mismos campos, validaciones y cálculos.
 */
export type PriceMode = 'public' | 'margin';

export interface ProductRequest {
  code: string;
  sku: string;
  brand: string;
  name: string;
  description: string | null;
  publicPrice: number;
  price: number;
  costPrice: number | null;
  unitPrice: number | null;
  allowsManualValueInSale: boolean;
  noDeliverySurcharge: number | null;
  categoryId: string | null;
}

export function buildProductForm(fb: FormBuilder): FormGroup {
  const form = fb.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    sku: ['', [Validators.required, Validators.maxLength(80)]],
    brand: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(1000)]],
    publicPrice: [0, [Validators.required, Validators.min(0)]],
    price: [0],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    unitPrice: [null, [Validators.min(0)]],
    marginPercent: [0],
    allowsManualSaleValue: [false],
    noDeliverySurcharge: [null, [Validators.min(0)]],
    category: [null]
  });

  updatePriceValidators(form);
  return form;
}

export function calculateMarginPercent(publicPrice: number, costPrice: number): number {
  if (costPrice <= 0 || publicPrice < 0) {
    return 0;
  }

  return ((publicPrice - costPrice) / costPrice) * 100;
}

export function syncPriceFromMargin(form: FormGroup, mode: PriceMode): void {
  if (mode !== 'margin') {
    return;
  }

  const costPrice = Number(form.get('costPrice')?.value ?? 0);
  const marginPercent = Number(form.get('marginPercent')?.value ?? 0);
  const publicPrice = costPrice > 0 ? costPrice * (1 + (marginPercent / 100)) : 0;
  form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
}

export function syncPriceMode(form: FormGroup, mode: PriceMode): void {
  if (form.get('allowsManualSaleValue')?.value) {
    form.patchValue({ publicPrice: 0, price: 0, marginPercent: 0 }, { emitEvent: false });
    return;
  }

  if (mode === 'margin') {
    form.patchValue({
      marginPercent: calculateMarginPercent(
        Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0),
        Number(form.get('costPrice')?.value ?? 0)
      )
    }, { emitEvent: false });
    syncPriceFromMargin(form, mode);
    return;
  }

  const publicPrice = Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
  form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
}

export function updatePriceValidators(form: FormGroup): void {
  const allowsManualSaleValue = Boolean(form.get('allowsManualSaleValue')?.value);
  const publicPriceControl = form.get('publicPrice');

  if (!publicPriceControl) {
    return;
  }

  publicPriceControl.setValidators([
    Validators.required,
    Validators.min(allowsManualSaleValue ? 0 : 0.01)
  ]);

  publicPriceControl.updateValueAndValidity({ emitEvent: false });
}

export function toProductRequest(form: FormGroup, canViewCostPrice: boolean): ProductRequest {
  const raw = form.getRawValue();
  const allowsManualSaleValue = Boolean(raw.allowsManualSaleValue);
  const publicPrice = allowsManualSaleValue ? 0 : Number(raw.publicPrice ?? raw.price ?? 0);

  return {
    code: String(raw.code || ''),
    sku: String(raw.sku || ''),
    brand: String(raw.brand || ''),
    name: String(raw.name || ''),
    description: raw.description?.trim() ? raw.description.trim() : null,
    publicPrice,
    price: publicPrice,
    // Sin products.view_cost el costo que muestra la API viene enmascarado (null), asi que
    // el formulario tiene un 0 que no representa nada: se manda null para que el back lo
    // preserve. Mandar ese 0 fue lo que borro los costos de MOURA el 21/09/2026.
    costPrice: canViewCostPrice ? Number(raw.costPrice ?? 0) : null,
    unitPrice: raw.unitPrice === null || raw.unitPrice === '' ? null : Number(raw.unitPrice),
    allowsManualValueInSale: allowsManualSaleValue,
    noDeliverySurcharge: raw.noDeliverySurcharge === null || raw.noDeliverySurcharge === '' ? null : Number(raw.noDeliverySurcharge),
    categoryId: raw.category ? String(raw.category) : null
  };
}

export function productFormValue(product: ProductResponse) {
  return {
    code: product.code,
    sku: product.sku,
    brand: product.brand,
    name: product.name,
    description: product.description ?? '',
    publicPrice: product.publicPrice ?? product.price,
    price: product.publicPrice ?? product.price,
    costPrice: product.costPrice ?? 0,
    unitPrice: product.unitPrice ?? null,
    marginPercent: calculateMarginPercent(product.publicPrice ?? product.price, product.costPrice ?? 0),
    allowsManualSaleValue: productAllowsManualSaleValue(product),
    noDeliverySurcharge: product.noDeliverySurcharge ?? null,
    category: product.categoryId ?? null
  };
}

export function normalizeBulkRequest(request: ProductRequest): ProductRequest {
  return {
    code: request.code.trim(),
    sku: request.sku.trim(),
    brand: request.brand.trim(),
    name: request.name.trim(),
    description: request.description ?? null,
    publicPrice: Number(request.publicPrice ?? 0),
    price: Number(request.price ?? 0),
    costPrice: Number(request.costPrice ?? 0),
    unitPrice: request.unitPrice == null ? null : Number(request.unitPrice),
    allowsManualValueInSale: Boolean(request.allowsManualValueInSale),
    noDeliverySurcharge: request.noDeliverySurcharge == null ? null : Number(request.noDeliverySurcharge),
    categoryId: request.categoryId ?? null
  };
}

export function areBulkRequestsEqual(left: ProductRequest, right: ProductRequest): boolean {
  return left.code === right.code
    && left.sku === right.sku
    && left.brand === right.brand
    && left.name === right.name
    && left.description === right.description
    && left.publicPrice === right.publicPrice
    && left.price === right.price
    && left.costPrice === right.costPrice
    && left.unitPrice === right.unitPrice
    && left.allowsManualValueInSale === right.allowsManualValueInSale
    && left.noDeliverySurcharge === right.noDeliverySurcharge
    && left.categoryId === right.categoryId;
}

/** Vista previa de precios para la lectura comercial / radar. */
export function publicPricePreview(form: FormGroup): number {
  return Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
}

export function costPricePreview(form: FormGroup): number {
  return Number(form.get('costPrice')?.value ?? 0);
}

export function marginPreview(form: FormGroup): number {
  const publicPrice = publicPricePreview(form);
  const costPrice = costPricePreview(form);
  if (costPrice <= 0 || publicPrice < 0) {
    return 0;
  }

  return ((publicPrice - costPrice) / costPrice) * 100;
}

export function stockMovementLabel(type: number): string {
  switch (type) {
    case 1: return 'Ingreso manual';
    case 2: return 'Ajuste manual';
    case 3: return 'Reserva';
    case 4: return 'Liberación';
    case 5: return 'Salida';
    case 6: return 'Canje (ingreso)';
    case 7: return 'Devolución de venta';
    case 8: return 'Ingreso por compra';
    case 9: return 'Devolución de compra';
    case 10: return 'Transferencia (salida)';
    case 11: return 'Transferencia (entrada)';
    default: return 'Movimiento';
  }
}
