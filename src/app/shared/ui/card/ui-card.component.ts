import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Tarjeta EITI 2 con encabezado opcional. Las acciones del encabezado van con `uiCardActions`. */
@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [NgIf],
  templateUrl: './ui-card.component.html',
  styleUrls: ['./ui-card.component.css'],
  host: { class: 'ui-card' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiCardComponent {
  @Input() heading = '';
  @Input() sub = '';
  @Input() count: number | string | null = null;
  /** Sin relleno en el cuerpo (tablas que llegan al borde). */
  @Input() flush = false;
}
