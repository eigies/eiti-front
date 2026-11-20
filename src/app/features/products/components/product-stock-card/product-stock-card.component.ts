import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BranchProductStockResponse, StockMovementResponse } from '../../../../core/models/stock.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiMovPillComponent } from '../../../../shared/ui';
import { stockMovementLabel } from '../../models/product-form';
import { isClickableMovement, stockMovementKind, stockMovementSign, stockMovementTone } from '../../models/product-view';

/** Tarjeta "Stock por sucursal": cifras, precio/costo de la sucursal, carga de stock y movimientos. */
@Component({
  selector: 'app-product-stock-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SearchableSelectComponent, UiCardComponent, UiButtonComponent, UiEmptyComponent, UiMovPillComponent],
  templateUrl: './product-stock-card.component.html',
  styleUrls: ['./product-stock-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductStockCardComponent {
  @Input() branchOptions: SearchableSelectOption[] = [];
  @Input() branchId = '';
  @Input() branchName = '';
  @Input() stock: BranchProductStockResponse | null = null;
  @Input() canManageStock = false;
  @Input() canViewCostPrice = false;
  @Input() pricingPrice: number | null = null;
  @Input() pricingCost: number | null = null;
  @Input() pricingSaving = false;
  @Input({ required: true }) stockForm!: FormGroup;
  @Input() movementOptions: SearchableSelectOption[] = [];
  @Input() saving = false;
  @Input() loading = false;
  @Input() movements: StockMovementResponse[] = [];

  @Output() branchChange = new EventEmitter<string>();
  @Output() pricingPriceChange = new EventEmitter<number | null>();
  @Output() pricingCostChange = new EventEmitter<number | null>();
  @Output() savePricing = new EventEmitter<void>();
  @Output() submitStock = new EventEmitter<void>();
  @Output() openMovement = new EventEmitter<StockMovementResponse>();
  @Output() openReservations = new EventEmitter<void>();

  readonly label = stockMovementLabel;
  readonly kind = stockMovementKind;
  readonly sign = stockMovementSign;
  readonly tone = stockMovementTone;
  readonly clickable = isClickableMovement;

  hint(movement: StockMovementResponse): string {
    return movement.referenceType === 'Purchase' ? 'Ver compra' : movement.referenceType === 'Transfer' ? 'Ver traspaso' : 'Ver venta';
  }

  trackById(_: number, movement: StockMovementResponse): string {
    return movement.id;
  }
}
