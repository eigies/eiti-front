import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Alta y edición de banco en popup. */
@Component({
  selector: 'app-bank-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiModalComponent, UiButtonComponent],
  templateUrl: './bank-form-modal.component.html',
  styleUrls: ['./bank-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() editing = false;
  @Input() saving = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
