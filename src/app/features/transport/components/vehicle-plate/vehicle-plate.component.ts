import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatPlate, plateStyle } from '../../models/transport-view';

/** Patente dibujada: la nueva blanca con franja azul, la vieja negra con letras blancas. */
@Component({
  selector: 'app-vehicle-plate',
  standalone: true,
  imports: [NgIf],
  templateUrl: './vehicle-plate.component.html',
  styleUrls: ['./vehicle-plate.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehiclePlateComponent {
  @Input() plate = '';
  get style(): string { return plateStyle(this.plate); }
  get text(): string { return formatPlate(this.plate); }
}
