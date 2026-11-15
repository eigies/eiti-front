import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../../shared/ui';

/** Alta de adelanto en popup. */
@Component({
  selector: 'app-advance-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './advance-form-modal.component.html',
  styleUrls: ['../../../liquidations/components/payroll-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvanceFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() employeeOptions: SearchableSelectOption[] = [];
  @Input() paymentMethods: SearchableSelectOption[] = [];
  @Input() cashDrawerOptions: SearchableSelectOption[] = [];
  @Input() usesCash = true;
  @Input() saving = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
