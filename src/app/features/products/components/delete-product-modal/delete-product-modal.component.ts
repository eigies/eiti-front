import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductResponse } from '../../../../core/models/product.models';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Confirmación en rojo para eliminar un producto. Tocar afuera la sacude. */
@Component({
  selector: 'app-delete-product-modal',
  standalone: true,
  imports: [UiModalComponent, UiButtonComponent],
  templateUrl: './delete-product-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeleteProductModalComponent {
  @Input({ required: true }) product!: ProductResponse;
  @Input() deleting = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
