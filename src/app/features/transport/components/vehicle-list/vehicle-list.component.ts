import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { VehicleResponse } from '../../../../core/models/vehicle.models';
import { UiButtonComponent } from '../../../../shared/ui';
import { VehiclePlateComponent } from '../vehicle-plate/vehicle-plate.component';

/** Vehículos con su patente dibujada; el seleccionado muestra su actividad al lado. */
@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, VehiclePlateComponent],
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehicleListComponent {
  @Input() vehicles: VehicleResponse[] = [];
  @Input() selectedId = '';
  @Output() select = new EventEmitter<string>();
  @Output() edit = new EventEmitter<VehicleResponse>();
}
