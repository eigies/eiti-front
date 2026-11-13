import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CcCancelRefundMode } from '../../../core/models/sale.models';

let nextGroupId = 0;

/**
 * Qué hacer con lo ya cobrado al anular una venta de cuenta corriente: dejarlo como saldo a favor o anular los
 * cobros. La misma elección en la cuenta del cliente y en Gestión de Ventas. Se usa con [(mode)].
 */
@Component({
  selector: 'app-cc-cancel-refund-options',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cc-cancel-refund-options.component.html',
  styleUrls: ['./cc-cancel-refund-options.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CcCancelRefundOptionsComponent {
  @Input({ required: true }) paidTotal = 0;
  @Input() mode: CcCancelRefundMode = CcCancelRefundMode.Credit;
  @Output() readonly modeChange = new EventEmitter<CcCancelRefundMode>();

  readonly modes = CcCancelRefundMode;
  /** Cada instancia con su grupo de radios: dos modales abiertos no se pisan la selección. */
  readonly groupName = `cc-refund-mode-${++nextGroupId}`;

  select(mode: CcCancelRefundMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeChange.emit(mode);
  }
}
