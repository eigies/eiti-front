import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent } from '../../../../shared/ui';
import { PriceMode, costPricePreview, marginPreview, publicPricePreview, syncPriceFromMargin } from '../../models/product-form';

/** Tarjeta "Modificar producto" con la lectura comercial en recuadro ámbar suave. */
@Component({
  selector: 'app-product-edit-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiCardComponent, UiButtonComponent],
  templateUrl: './product-edit-card.component.html',
  styleUrls: ['./product-edit-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductEditCardComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() priceMode: PriceMode = 'public';
  @Input() canViewCostPrice = false;
  @Input() categoryOptions: SearchableSelectOption[] = [];
  @Input() saving = false;
  @Output() priceModeChange = new EventEmitter<PriceMode>();
  @Output() manualSaleValueChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<void>();

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
