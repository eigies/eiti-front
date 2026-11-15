import { FormGroup } from '@angular/forms';
import { ProductResponse, productPublicPrice } from '../../../core/models/product.models';
import { StockMovementResponse } from '../../../core/models/stock.models';
import { UiMovKind } from '../../../shared/ui';
import { ProductRequest, normalizeBulkRequest, toProductRequest } from './product-form';

/** Contexto de costo/precio por sucursal que muestra el catálogo ('' = global de empresa). */
export interface CostBranchContext {
  branchId: string;
  costs: Map<string, number>;
  prices: Map<string, number>;
}

// Costo a mostrar en la grilla: override de la sucursal en contexto si existe, si no el global.
export function displayCost(product: ProductResponse, ctx: CostBranchContext): number {
  if (ctx.branchId) {
    return ctx.costs.get(product.id) ?? product.costPrice ?? 0;
  }
  return product.costPrice ?? 0;
}

// Precio público a mostrar en la grilla: override de la sucursal en contexto si existe, si no el global.
export function displayPublicPrice(product: ProductResponse, ctx: CostBranchContext): number {
  if (ctx.branchId) {
    return ctx.prices.get(product.id) ?? productPublicPrice(product);
  }
  return productPublicPrice(product);
}

/** Si un campo de la fila cambió respecto de cómo estaba al entrar a la edición masiva. */
export function bulkFieldChanged(form: FormGroup, snapshot: ProductRequest, field: string, canViewCostPrice: boolean): boolean {
  const current = normalizeBulkRequest(toProductRequest(form, canViewCostPrice)) as unknown as Record<string, unknown>;
  const base = normalizeBulkRequest(snapshot) as unknown as Record<string, unknown>;
  if (field === 'allowsManualSaleValue') {
    // Igual que antes: compara la clave del formulario, que no está en el request normalizado.
    return current['allowsManualSaleValue'] !== base['allowsManualSaleValue'];
  }
  if (field === 'category') {
    return current['categoryId'] !== base['categoryId'];
  }
  return current[field] !== base[field];
}

/** Pastilla de color de cada tipo de movimiento de stock. */
export function stockMovementKind(type: number): UiMovKind {
  switch (type) {
    case 1: return 'in';
    case 3: return 'cc-void';
    case 5: return 'sale';
    case 6: return 'in';
    case 7: return 'customer-nc';
    case 8: return 'supplier';
    case 9: return 'supplier-nc';
    case 10: return 'transfer-out';
    case 11: return 'transfer-in';
    default: return 'neutral';
  }
}

/** Signo y tono de la cantidad, igual que antes: reserva +/-, salida y traspaso de salida en negativo. */
export function stockMovementSign(movement: StockMovementResponse): string {
  if (movement.type === 3) return '+/-';
  if (movement.type === 5 || movement.type === 10) return '-';
  return movement.quantity > 0 ? '+' : '';
}

export function stockMovementTone(movement: StockMovementResponse): 'pos' | 'neg' | 'reserved' {
  if (movement.type === 3) return 'reserved';
  if (movement.type === 5 || movement.type === 10 || movement.quantity < 0) return 'neg';
  return 'pos';
}

export function isClickableMovement(movement: StockMovementResponse): boolean {
  return !!movement.referenceId &&
    (movement.referenceType === 'Sale' || movement.referenceType === 'Purchase' || movement.referenceType === 'Transfer');
}
