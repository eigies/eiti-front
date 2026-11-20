import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FleetLogResponse, VehicleResponse } from '../../../../core/models/vehicle.models';
import { UiButtonComponent, UiEmptyComponent, UiMovPillComponent, UiMovKind } from '../../../../shared/ui';
import { logKind } from '../../models/transport-view';
import { VehiclePlateComponent } from '../vehicle-plate/vehicle-plate.component';

/** Actividad del vehículo seleccionado: registros con el color de su tipo. */
@Component({
  selector: 'app-vehicle-activity',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiEmptyComponent, UiMovPillComponent, VehiclePlateComponent],
  templateUrl: './vehicle-activity.component.html',
  styleUrls: ['./vehicle-activity.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehicleActivityComponent {
  @Input({ required: true }) vehicle!: VehicleResponse;
  @Input() logs: FleetLogResponse[] = [];
  @Input() labelFn: (typeName: string) => string = name => name;
  @Output() newLog = new EventEmitter<void>();

  kind(typeName: string): UiMovKind {
    return logKind(typeName) as UiMovKind;
  }
}
