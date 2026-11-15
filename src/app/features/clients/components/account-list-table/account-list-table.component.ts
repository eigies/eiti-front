import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CustomerAccountListItem } from '../../../../core/models/customer-account.models';
import { UiAvatarComponent, UiButtonComponent, UiTableWrapComponent } from '../../../../shared/ui';

/** Cuentas corrientes: pendiente en rojo, a favor en verde. */
@Component({
  selector: 'app-account-list-table',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent, UiButtonComponent, UiTableWrapComponent],
  templateUrl: './account-list-table.component.html',
  styleUrls: ['./account-list-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountListTableComponent {
  @Input() accounts: CustomerAccountListItem[] = [];
  @Input() withDebt = 0;
  @Output() open = new EventEmitter<string>();

  trackById(_: number, account: CustomerAccountListItem): string {
    return account.customerId;
  }
}
