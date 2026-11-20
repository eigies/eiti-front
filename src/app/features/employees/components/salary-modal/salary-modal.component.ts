import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EmployeeResponse } from '../../../../core/models/employee.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiAvatarComponent, UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Sueldo base y periodicidad de un empleado, en popup. */
@Component({
  selector: 'app-salary-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent, UiAvatarComponent],
  templateUrl: './salary-modal.component.html',
  styleUrls: ['./salary-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalaryModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) employee!: EmployeeResponse;
  @Input() periodicities: SearchableSelectOption[] = [];
  @Input() saving = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
