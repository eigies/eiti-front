import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DriverResponse } from '../../../../core/models/employee.models';
import { UiAvatarComponent, UiButtonComponent, UiTableWrapComponent } from '../../../../shared/ui';

/** Conductores: licencia vencida en rojo con aviso de que no se puede asignar. */
@Component({
  selector: 'app-driver-list',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent, UiButtonComponent, UiTableWrapComponent],
  templateUrl: './driver-list.component.html',
  styleUrls: ['./driver-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriverListComponent {
  @Input() drivers: DriverResponse[] = [];
  @Input() canDelete = false;
  @Input() deletingId: string | null = null;
  @Output() edit = new EventEmitter<DriverResponse>();
  @Output() remove = new EventEmitter<DriverResponse>();
}
