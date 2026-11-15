import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Edición de un concepto de sueldo en popup. */
@Component({
  selector: 'app-concept-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiModalComponent, UiButtonComponent],
  templateUrl: './concept-edit-modal.component.html',
  styleUrls: ['../../liquidations/components/payroll-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConceptEditModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() withPercentage = false;
  @Input() saving = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
