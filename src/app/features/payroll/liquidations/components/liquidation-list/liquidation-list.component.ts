import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PayrollLiquidationResponse } from '../../../../../core/models/payroll.models';
import { UiAvatarComponent, UiReceiptComponent } from '../../../../../shared/ui';
import { liquidationStatusBadge } from '../../models/liquidation-view';

/** Listado con detalle que se abre: cada liquidación se despliega con descuentos, bonificaciones, adelantos y el recibo. */
@Component({
  selector: 'app-liquidation-list',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent, UiReceiptComponent],
  templateUrl: './liquidation-list.component.html',
  styleUrls: ['./liquidation-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiquidationListComponent {
  @Input() liquidations: PayrollLiquidationResponse[] = [];
  @Input() expandedId: string | null = null;
  @Input() canPay = false;
  @Input() cancellingId: string | null = null;
  @Input() nameOf: (employeeId: string) => string = id => id;
  @Input() statusOf: (status: number) => string = () => '';
  @Input() methodOf: (method: number | null) => string = () => '—';
  @Input() totalOf: (lines: Array<{ amount: number }>) => number = () => 0;

  @Output() pay = new EventEmitter<PayrollLiquidationResponse>();
  @Output() cancel = new EventEmitter<PayrollLiquidationResponse>();
  @Output() toggle = new EventEmitter<PayrollLiquidationResponse>();
  @Output() receipt = new EventEmitter<PayrollLiquidationResponse>();

  readonly badge = liquidationStatusBadge;

  trackById(_index: number, liquidation: PayrollLiquidationResponse): string {
    return liquidation.id;
  }
}
