import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PayrollAdvanceResponse } from '../../../../../core/models/payroll.models';
import { UiAvatarComponent } from '../../../../../shared/ui';

/** Tabla de adelantos: empleado, fecha, monto, pago, notas y estado. */
@Component({
  selector: 'app-advance-list',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent],
  templateUrl: './advance-list.component.html',
  styleUrls: ['./advance-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvanceListComponent {
  @Input() advances: PayrollAdvanceResponse[] = [];
  @Input() canManage = false;
  @Input() cancellingId: string | null = null;
  @Input() nameOf: (employeeId: string) => string = id => id;
  @Input() statusOf: (status: number) => string = () => '';
  @Input() badgeOf: (status: number) => string = () => 'ui-badge';
  @Input() payOf: (advance: PayrollAdvanceResponse) => string = () => '';
  @Output() cancel = new EventEmitter<PayrollAdvanceResponse>();

  trackById(_index: number, advance: PayrollAdvanceResponse): string {
    return advance.id;
  }
}
