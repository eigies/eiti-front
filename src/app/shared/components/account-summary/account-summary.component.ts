import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UiTicketComponent } from '../../ui';

/**
 * Resumen de una cuenta corriente (clientes y proveedores): el saldo pendiente en el ticket
 * y deuda total, cobrado/pagado y saldo a favor en una tarjeta al lado.
 */
@Component({
  selector: 'app-account-summary',
  standalone: true,
  imports: [CommonModule, UiTicketComponent],
  templateUrl: './account-summary.component.html',
  styleUrls: ['./account-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSummaryComponent {
  @Input() pending = 0;
  @Input() total = 0;
  @Input() paid = 0;
  @Input() favor = 0;
  @Input() pendingHint = 'Importe pendiente de cobro';
  @Input() totalHint = '';
  @Input() paidLabel = 'Cobrado';
  @Input() paidHint = '';
  @Input() favorHint = 'Disponible para próximas ventas';
}
