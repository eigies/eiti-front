import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TransferDetailResponse } from '../../../../core/models/stock.models';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Detalle de un traspaso de stock entre sucursales (popup común). */
@Component({
  selector: 'app-transfer-detail-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiButtonComponent],
  templateUrl: './transfer-detail-modal.component.html',
  styleUrls: ['./movement-detail-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferDetailModalComponent {
  @Input() transfer: TransferDetailResponse | null = null;
  @Input() loading = false;
  @Output() closed = new EventEmitter<void>();
  @Output() downloadPdf = new EventEmitter<TransferDetailResponse>();

  get heading(): string {
    if (this.loading || !this.transfer) {
      return 'Cargando traspaso...';
    }
    return `${this.transfer.fromBranchName || '—'} → ${this.transfer.toBranchName || '—'}`;
  }
}
