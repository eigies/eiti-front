import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Contenedor de tabla con desplazamiento horizontal; la tabla adentro usa la clase `ui-table`. */
@Component({
  selector: 'ui-table-wrap',
  standalone: true,
  templateUrl: './ui-table.component.html',
  styleUrls: ['./ui-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTableWrapComponent {}
