import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Alta y edición de conductor en popup. */
@Component({
  selector: 'app-driver-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiModalComponent, UiButtonComponent],
  templateUrl: './driver-form-modal.component.html',
  styleUrls: ['./transport-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriverFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() editing = false;
  @Input() saving = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
