import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../ui';

/** Nota de crédito de una cuenta corriente (cliente o proveedor) en popup. */
@Component({
  selector: 'app-account-credit-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './account-credit-note-modal.component.html',
  styleUrls: ['./account-credit-note-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountCreditNoteModalComponent {
  @Input() heading = 'Emitir nota de crédito';
  @Input() sub = 'Baja la deuda del cliente sin registrar un cobro. Se imputa sobre las ventas pendientes más viejas.';
  @Input() reasonPlaceholder = 'Bonificación acordada, error de facturación, diferencia de precio...';
  @Input() linkLabel = 'Venta asociada';
  @Input() linkPlaceholder = 'Sin venta asociada';
  @Input() linkSearchPlaceholder = 'Buscar venta...';
  @Input() submitLabel = 'Emitir nota de crédito';
  @Input() submittingLabel = 'Emitiendo...';
  @Input() amount = 0;
  @Input() date = '';
  @Input() reason = '';
  @Input() saleId: string | null = null;
  @Input() saleOptions: SearchableSelectOption[] = [];
  @Input() canSubmit = false;
  @Input() submitting = false;
  @Output() amountChange = new EventEmitter<number>();
  @Output() dateChange = new EventEmitter<string>();
  @Output() reasonChange = new EventEmitter<string>();
  @Output() saleIdChange = new EventEmitter<string | null>();
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
