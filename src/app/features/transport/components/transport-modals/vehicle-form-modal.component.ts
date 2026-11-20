import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Alta y edición de vehículo en popup. */
@Component({
  selector: 'app-vehicle-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './vehicle-form-modal.component.html',
  styleUrls: ['./transport-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehicleFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() editing = false;
  @Input() saving = false;
  @Input() fuelOptions: SearchableSelectOption[] = [];
  @Input() driverOptions: SearchableSelectOption[] = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
