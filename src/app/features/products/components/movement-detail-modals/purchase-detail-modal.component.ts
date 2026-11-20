import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PurchaseDetailResponse } from '../../../../core/models/purchase.models';
import { UiModalComponent, UiReceiptComponent } from '../../../../shared/ui';

/** Detalle de una compra con forma de recibo. */
@Component({
  selector: 'app-purchase-detail-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiReceiptComponent],
  templateUrl: './purchase-detail-modal.component.html',
  styleUrls: ['./movement-detail-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseDetailModalComponent {
  @Input() purchase: PurchaseDetailResponse | null = null;
  @Input() loading = false;
  @Output() closed = new EventEmitter<void>();
}
