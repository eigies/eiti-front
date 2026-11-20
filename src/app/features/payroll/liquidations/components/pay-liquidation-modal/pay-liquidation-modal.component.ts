import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PayrollLiquidationResponse } from '../../../../../core/models/payroll.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent, UiTicketComponent } from '../../../../../shared/ui';

/** Pagar liquidación: el neto en el ticket, medio de pago y caja abierta. */
@Component({
  selector: 'app-pay-liquidation-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent, UiTicketComponent],
  templateUrl: './pay-liquidation-modal.component.html',
  styleUrls: ['../payroll-modals.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PayLiquidationModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) target!: PayrollLiquidationResponse;
  @Input() employeeName = '';
  @Input() paymentMethods: SearchableSelectOption[] = [];
  @Input() cashDrawerOptions: SearchableSelectOption[] = [];
  @Input() usesCash = true;
  @Input() paying = false;
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
