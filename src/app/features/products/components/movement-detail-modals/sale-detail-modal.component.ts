import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SaleByIdResponse } from '../../../../core/models/sale.models';
import { UiModalComponent, UiReceiptComponent } from '../../../../shared/ui';

/** Detalle de una venta con forma de recibo. */
@Component({
  selector: 'app-sale-detail-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiReceiptComponent],
  templateUrl: './sale-detail-modal.component.html',
  styleUrls: ['./movement-detail-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaleDetailModalComponent {
  @Input() sale: SaleByIdResponse | null = null;
  @Input() loading = false;
  @Output() closed = new EventEmitter<void>();
}
