import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Nuevo registro de flota (combustible, mantenimiento, inspección, incidente o nota) en popup. */
@Component({
  selector: 'app-log-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './log-form-modal.component.html',
  styleUrls: ['./transport-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() plate = '';
  @Input() typeOptions: SearchableSelectOption[] = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
