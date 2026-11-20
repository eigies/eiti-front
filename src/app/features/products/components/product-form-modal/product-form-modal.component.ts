import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent, UiTicketComponent } from '../../../../shared/ui';
import { PriceMode, costPricePreview, marginPreview, publicPricePreview, syncPriceFromMargin } from '../../models/product-form';

/** Alta de producto en popup grande, con el radar comercial en el ticket. */
@Component({
  selector: 'app-product-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent, UiTicketComponent],
  templateUrl: './product-form-modal.component.html',
  styleUrls: ['./product-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductFormModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() priceMode: PriceMode = 'public';
  @Input() canViewCostPrice = false;
  @Input() categoryOptions: SearchableSelectOption[] = [];
  @Input() saving = false;
  @Output() priceModeChange = new EventEmitter<PriceMode>();
  @Output() manualSaleValueChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  get manual(): boolean {
    return !!this.form.get('allowsManualSaleValue')?.value;
  }

  get price(): number { return publicPricePreview(this.form); }
  get cost(): number { return costPricePreview(this.form); }
  get margin(): number { return marginPreview(this.form); }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  syncFromMargin(): void {
    syncPriceFromMargin(this.form, this.priceMode);
  }
}
