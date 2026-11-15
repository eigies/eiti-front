import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../../../core/models/product.models';
import { CostBranchContext, displayCost, displayPublicPrice } from '../../models/product-view';
import { ProductToggle } from '../product-table/product-table.component';

/** Vista en tarjetas del catálogo. */
@Component({
  selector: 'app-product-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-cards.component.html',
  styleUrls: ['./product-cards.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardsComponent {
  @Input() products: ProductResponse[] = [];
  @Input() selectedIds = new Set<string>();
  @Input() canViewCostPrice = false;
  @Input({ required: true }) costContext!: CostBranchContext;
  @Output() toggleProduct = new EventEmitter<ProductToggle>();
  @Output() cardClick = new EventEmitter<ProductResponse>();
  @Output() open = new EventEmitter<ProductResponse>();

  readonly allowsManual = productAllowsManualSaleValue;
  readonly visiblePrice = productPublicPrice;

  cost(product: ProductResponse): number {
    return displayCost(product, this.costContext);
  }

  price(product: ProductResponse): number {
    return displayPublicPrice(product, this.costContext);
  }

  trackById(_: number, product: ProductResponse): string {
    return product.id;
  }
}
