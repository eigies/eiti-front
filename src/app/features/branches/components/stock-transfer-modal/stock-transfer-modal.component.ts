import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';

/** Traspaso de stock entre sucursales, en popup: origen → destino, referencia y renglones de productos. */
@Component({
  selector: 'app-stock-transfer-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiModalComponent, UiButtonComponent],
  templateUrl: './stock-transfer-modal.component.html',
  styleUrls: ['./stock-transfer-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class StockTransferModalComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) items!: FormArray;
  @Input() sourceOptions: SearchableSelectOption[] = [];
  @Input() destinationOptions: SearchableSelectOption[] = [];
  @Input() productOptionsFor: (index: number) => SearchableSelectOption[] = () => [];
  @Input() availableFor: (productId: string | null | undefined) => number | null = () => null;
  @Input() stockLoading = false;
  @Input() saving = false;
  @Output() addItem = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<number>();
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  get unitCount(): number {
    return this.items.controls.reduce((sum, group) => sum + Number(group.get('quantity')?.value || 0), 0);
  }

  isOver(group: FormGroup | unknown): boolean {
    const g = group as FormGroup;
    const available = this.availableFor(g.get('productId')?.value);
    return available !== null && Number(g.get('quantity')?.value || 0) > available;
  }
}
