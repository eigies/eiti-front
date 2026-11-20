import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Alta y edición de sucursal en popup. En edición suma facturación y punto de venta. */
@Component({
  selector: 'app-branch-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './branch-form-modal.component.html',
  styleUrls: ['./branch-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BranchFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() editing = false;
  @Input() saving = false;
  @Input() invoicingOptions: SearchableSelectOption[] = [];
  @Input() canAssignPointOfSale = false;
  @Input() pointOfSaleOptions: SearchableSelectOption[] = [];
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
}
