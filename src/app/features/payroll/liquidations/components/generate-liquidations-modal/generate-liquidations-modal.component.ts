import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { GeneratePayrollPeriodResponse } from '../../../../../core/models/payroll.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../../shared/ui';

/** Generar liquidaciones de un período, en popup. El resultado queda a la vista hasta cerrar. */
@Component({
  selector: 'app-generate-liquidations-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './generate-liquidations-modal.component.html',
  styleUrls: ['../payroll-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenerateLiquidationsModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() periodicities: SearchableSelectOption[] = [];
  @Input() generating = false;
  @Input() result: GeneratePayrollPeriodResponse | null = null;
  @Output() periodChanged = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
