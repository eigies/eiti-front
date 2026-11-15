import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { guidedStepTitle } from '../../models/guided-sale-view';

/** Pasos de la Venta guiada: hechos con tilde, el actual resaltado y los que faltan apagados. */
@Component({
  selector: 'app-guided-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guided-stepper.component.html',
  styleUrls: ['./guided-stepper.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuidedStepperComponent {
  @Input() labels: string[] = [];
  @Input() step = 1;
  @Output() jump = new EventEmitter<number>();

  title(label: string): string { return guidedStepTitle(label); }
}
