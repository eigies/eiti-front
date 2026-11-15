import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CancelInvoicingNotice, CcCancelRefundMode } from '../../../../core/models/sale.models';
import { CcCancelRefundOptionsComponent } from '../../../../shared/components/cc-cancel-refund-options/cc-cancel-refund-options.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Anular una venta de cuenta corriente: confirmación irreversible (tocar afuera la sacude). */
@Component({
  selector: 'app-cancel-cc-sale-modal',
  standalone: true,
  imports: [CommonModule, CcCancelRefundOptionsComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './cancel-cc-sale-modal.component.html',
  styleUrls: ['./cancel-cc-sale-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CancelCcSaleModalComponent {
  @Input() saleCode: string | null = null;
  @Input() canceling = false;
  @Input() notice: CancelInvoicingNotice | null = null;
  @Input() hasPayments = false;
  @Input() paidTotal = 0;
  @Input() refundMode: CcCancelRefundMode = CcCancelRefundMode.Credit;
  @Output() refundModeChange = new EventEmitter<CcCancelRefundMode>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
