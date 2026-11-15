import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductReservationsResponse } from '../../../../core/models/stock.models';
import { UiEmptyComponent, UiModalComponent } from '../../../../shared/ui';

/** Ventas que tienen reservado stock del producto. Cada una abre su detalle. */
@Component({
  selector: 'app-reservations-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiEmptyComponent],
  templateUrl: './reservations-modal.component.html',
  styleUrls: ['./movement-detail-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationsModalComponent {
  @Input() reservations: ProductReservationsResponse | null = null;
  @Input() loading = false;
  @Input() scope = '';
  @Output() closed = new EventEmitter<void>();
  @Output() openSale = new EventEmitter<string>();
}
