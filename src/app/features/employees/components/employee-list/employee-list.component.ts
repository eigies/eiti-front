import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { EmployeeResponse } from '../../../../core/models/employee.models';
import { UiAvatarComponent } from '../../../../shared/ui';

/** Nómina: empleado, estado, sueldo base y periodicidad. */
@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent],
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent {
  @Input() employees: EmployeeResponse[] = [];
  @Input() canManage = false;
  @Input() periodicityOf: (value: number | null) => string = () => '—';
  @Output() configure = new EventEmitter<EmployeeResponse>();

  trackById(_index: number, employee: EmployeeResponse): string {
    return employee.id;
  }
}
