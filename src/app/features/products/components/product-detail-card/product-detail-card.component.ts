import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductResponse } from '../../../../core/models/product.models';
import { UiCardComponent } from '../../../../shared/ui';

/** Tarjeta "Detalle": identidad del producto y stock global. */
@Component({
  selector: 'app-product-detail-card',
  standalone: true,
  imports: [CommonModule, UiCardComponent],
  templateUrl: './product-detail-card.component.html',
  styleUrls: ['./product-detail-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailCardComponent {
  @Input({ required: true }) product!: ProductResponse;
  @Output() openReservations = new EventEmitter<void>();
}
