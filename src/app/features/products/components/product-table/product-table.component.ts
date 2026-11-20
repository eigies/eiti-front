import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../../../core/models/product.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiTableWrapComponent } from '../../../../shared/ui';
import { ProductRequest } from '../../models/product-form';
import { CostBranchContext, bulkFieldChanged, displayCost, displayPublicPrice } from '../../models/product-view';

export interface ProductToggle { product: ProductResponse; checked: boolean; }
export interface ManualToggle { productId: string; checked: boolean; }

/** Tabla del catálogo con todas las columnas, orden, selección y edición masiva en línea. */
@Component({
  selector: 'app-product-table',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiTableWrapComponent],
  templateUrl: './product-table.component.html',
  styleUrls: ['./product-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductTableComponent {
  @Input() products: ProductResponse[] = [];
  @Input() fallbackForm!: FormGroup;
  @Input() bulkEditMode = false;
  @Input() bulkForms: Record<string, FormGroup> = {};
  @Input() bulkSnapshots: Record<string, ProductRequest> = {};
  @Input() selectedIds = new Set<string>();
  @Input() modifiedIds = new Set<string>();
  @Input() allSelected = false;
  @Input() someSelected = false;
  @Input() selectAllDisabled = false;
  @Input() showHiddenColumns = false;
  @Input() canViewCostPrice = false;
  @Input({ required: true }) costContext!: CostBranchContext;
  @Input() sortColumn: string | null = null;
  @Input() sortDir: 'asc' | 'desc' = 'desc';
  @Input() categoryOptions: SearchableSelectOption[] = [];

  @Output() sort = new EventEmitter<string>();
  @Output() toggleAll = new EventEmitter<boolean>();
  @Output() toggleProduct = new EventEmitter<ProductToggle>();
  @Output() rowClick = new EventEmitter<ProductResponse>();
  @Output() open = new EventEmitter<ProductResponse>();
  @Output() manualToggle = new EventEmitter<ManualToggle>();

  readonly allowsManual = productAllowsManualSaleValue;
  readonly visiblePrice = productPublicPrice;

  form(productId: string): FormGroup {
    return this.bulkForms[productId] ?? this.fallbackForm;
  }

  editable(productId: string): boolean {
    return this.bulkEditMode && this.selectedIds.has(productId);
  }

  modified(productId: string): boolean {
    return this.bulkEditMode && this.modifiedIds.has(productId);
  }

  changed(productId: string, field: string): boolean {
    if (!this.modified(productId)) {
      return false;
    }
    const form = this.bulkForms[productId];
    const snapshot = this.bulkSnapshots[productId];
    return !!form && !!snapshot && bulkFieldChanged(form, snapshot, field, this.canViewCostPrice);
  }

  invalid(productId: string, field: string): boolean {
    if (!this.bulkEditMode) {
      return false;
    }
    const control = this.bulkForms[productId]?.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  cost(product: ProductResponse): number {
    return displayCost(product, this.costContext);
  }

  price(product: ProductResponse): number {
    return displayPublicPrice(product, this.costContext);
  }

  sortMark(col: string): string {
    return this.sortColumn === col ? (this.sortDir === 'desc' ? '↓' : '↑') : '↕';
  }

  trackById(_: number, product: ProductResponse): string {
    return product.id;
  }
}
