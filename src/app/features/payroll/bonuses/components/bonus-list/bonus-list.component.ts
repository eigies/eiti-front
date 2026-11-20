import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PayrollBonusResponse } from '../../../../../core/models/payroll.models';
import { UiAvatarComponent } from '../../../../../shared/ui';

/** Tabla de bonificaciones: empleado, concepto, monto y estado. */
@Component({
  selector: 'app-bonus-list',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent],
  templateUrl: './bonus-list.component.html',
  styleUrls: ['../../../advances/components/advance-list/advance-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BonusListComponent {
  @Input() bonuses: PayrollBonusResponse[] = [];
  @Input() canManage = false;
  @Input() cancellingId: string | null = null;
  @Input() nameOf: (employeeId: string) => string = id => id;
  @Input() conceptOf: (conceptId: string) => string = id => id;
  @Input() amountOf: (bonus: PayrollBonusResponse) => string = () => '';
  @Input() statusOf: (status: number) => string = () => '';
  @Input() badgeOf: (status: number) => string = () => 'ui-badge';
  @Output() cancel = new EventEmitter<PayrollBonusResponse>();

  trackById(_index: number, bonus: PayrollBonusResponse): string {
    return bonus.id;
  }
}
