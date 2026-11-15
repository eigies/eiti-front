import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent } from '../../../../shared/ui';

export type ProductFilterField = 'brand' | 'code' | 'sku' | 'product' | 'category';
export interface ProductFilterChange { field: ProductFilterField; value: string; }
export interface ProductFilterValues { brand: string; code: string; sku: string; product: string; category: string; }

/** Filtros del catálogo en una fila, más la etiqueta del filtro "sin costo". */
@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, UiButtonComponent],
  templateUrl: './product-filters.component.html',
  styleUrls: ['./product-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductFiltersComponent {
  @Input() brand = '';
  @Input() code = '';
  @Input() sku = '';
  @Input() product = '';
  @Input() category = '';
  @Input() brandOptions: SearchableSelectOption[] = [];
  @Input() categoryOptions: SearchableSelectOption[] = [];
  @Input() noCostActive = false;
  @Input() noCostCount = 0;
  @Output() filterChange = new EventEmitter<ProductFilterChange>();
  @Output() clear = new EventEmitter<void>();
  @Output() toggleNoCost = new EventEmitter<void>();

  set(field: ProductFilterField, value: string): void {
    this.filterChange.emit({ field, value });
  }
}
