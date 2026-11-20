import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiMovKind =
  | 'sale' | 'in' | 'out' | 'transfer-out' | 'transfer-in' | 'cc' | 'cc-void'
  | 'supplier' | 'supplier-nc' | 'payroll' | 'customer-nc' | 'neutral';

/** Pastilla de color por tipo de movimiento. Siempre lleva su etiqueta. */
@Component({
  selector: 'ui-mov-pill',
  standalone: true,
  templateUrl: './ui-mov-pill.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiMovPillComponent {
  @Input() kind: UiMovKind = 'neutral';
  @Input() label = '';
}
