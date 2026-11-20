import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TransferDetailResponse } from '../../../../../core/models/stock.models';
import { UiButtonComponent, UiModalComponent } from '../../../../../shared/ui';

/** Popup con el detalle de un traspaso entre sucursales. Solo presentación. */
@Component({
  selector: 'app-transfer-detail-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiButtonComponent],
  templateUrl: './transfer-detail-modal.component.html',
  styleUrls: ['./transfer-detail-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferDetailModalComponent {
  @Input() transfer: TransferDetailResponse | null = null;
  @Input() loading = false;
  @Input() date = '';
  @Input() totalQuantity = '';
  @Output() closed = new EventEmitter<void>();

  qty(n: number): string { return n.toLocaleString('es-AR'); }
}
