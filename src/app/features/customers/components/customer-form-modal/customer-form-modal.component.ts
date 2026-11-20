import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Alta y edición de cliente en popup (identidad, documentación y domicilio). */
@Component({
  selector: 'app-customer-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './customer-form-modal.component.html',
  styleUrls: ['./customer-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() editing = false;
  @Input() saving = false;
  @Input() documentTypeOptions: SearchableSelectOption[] = [];
  @Input() ivaConditionOptions: SearchableSelectOption[] = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
