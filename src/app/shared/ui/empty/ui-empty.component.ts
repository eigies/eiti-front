import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiEmptyIcon = 'box' | 'search' | 'list' | 'clock';

/** Estado vacío: un ícono de línea, un título y una ayuda. */
@Component({
  selector: 'ui-empty',
  standalone: true,
  imports: [NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault],
  templateUrl: './ui-empty.component.html',
  styleUrls: ['./ui-empty.component.css'],
  host: { class: 'ui-empty' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiEmptyComponent {
  @Input() icon: UiEmptyIcon = 'box';
  @Input() heading = '';
  @Input() text = '';
}
