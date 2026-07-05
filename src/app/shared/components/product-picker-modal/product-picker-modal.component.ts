import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductPickerRow, ProductPickerSelection } from './product-picker-modal.models';

/** Umbral de stock por debajo del cual el chip se muestra en ámbar (stock bajo). */
const LOW_STOCK_THRESHOLD = 3;

@Component({
  selector: 'app-product-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-picker-modal.component.html',
  styleUrls: ['./product-picker-modal.component.css']
})
export class ProductPickerModalComponent implements AfterViewInit {
  @Input() rows: ProductPickerRow[] = [];
  @Input() title = 'Selector de productos';

  @Output() confirm = new EventEmitter<ProductPickerSelection[]>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  query = '';
  private readonly selectedIds = new Set<string>();
  private readonly quantityById = new Map<string, number>();

  ngAfterViewInit(): void {
    // Foco al buscador al abrir (el padre monta el componente con *ngIf).
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  get filteredRows(): ProductPickerRow[] {
    const normalized = this.query.trim().toLowerCase();
    if (!normalized) {
      return this.rows;
    }
    return this.rows.filter(row => row.search.includes(normalized));
  }

  get totalRows(): number {
    return this.rows.length;
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get totalUnits(): number {
    let total = 0;
    for (const id of this.selectedIds) {
      total += this.quantityOf(id);
    }
    return total;
  }

  trackById(_index: number, row: ProductPickerRow): string {
    return row.id;
  }

  isSelectable(row: ProductPickerRow): boolean {
    return row.available > 0;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  quantityOf(id: string): number {
    return this.quantityById.get(id) ?? 1;
  }

  stockLevel(available: number): 'out' | 'low' | 'ok' {
    if (available <= 0) {
      return 'out';
    }
    return available <= LOW_STOCK_THRESHOLD ? 'low' : 'ok';
  }

  toggleRow(row: ProductPickerRow): void {
    if (!this.isSelectable(row)) {
      return;
    }
    if (this.selectedIds.has(row.id)) {
      this.selectedIds.delete(row.id);
      this.quantityById.delete(row.id);
    } else {
      this.selectedIds.add(row.id);
      if (!this.quantityById.has(row.id)) {
        this.quantityById.set(row.id, 1);
      }
    }
  }

  /** Cambiar la cantidad auto-selecciona la fila (y la clampa a [1, available]). */
  setQuantity(row: ProductPickerRow, rawValue: string): void {
    if (!this.isSelectable(row)) {
      return;
    }
    const parsed = Number(rawValue);
    const max = Math.max(1, row.available);
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : 1;
    this.quantityById.set(row.id, quantity);
    this.selectedIds.add(row.id);
  }

  stepQuantity(row: ProductPickerRow, delta: number): void {
    if (!this.isSelectable(row)) {
      return;
    }
    this.setQuantity(row, String(this.quantityOf(row.id) + delta));
  }

  clearSearch(): void {
    this.query = '';
    this.searchInput?.nativeElement.focus();
  }

  onConfirm(): void {
    if (this.selectedIds.size === 0) {
      return;
    }
    const selection: ProductPickerSelection[] = [...this.selectedIds].map(id => ({
      id,
      quantity: this.quantityOf(id)
    }));
    this.confirm.emit(selection);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onCancel();
  }
}
