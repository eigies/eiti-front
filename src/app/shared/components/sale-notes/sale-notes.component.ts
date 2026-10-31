import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../../core/services/sale.service';
import { ToastService } from '../../services/toast.service';

/** Mismo límite que Sale.NotesMaxLength en el back. */
export const SALE_NOTES_MAX_LENGTH = 500;

/**
 * Observaciones de una venta: se ven y, con permiso, se corrigen en el lugar. La corrección va por su propio
 * endpoint, así vale con la venta cobrada o facturada (la nota no es dato fiscal).
 */
@Component({
  selector: 'app-sale-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale-notes.component.html',
  styleUrls: ['./sale-notes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaleNotesComponent {
  @Input({ required: true }) saleId = '';
  @Input() notes: string | null | undefined = null;
  @Input() canEdit = false;
  @Output() readonly saved = new EventEmitter<string | null>();

  readonly maxLength = SALE_NOTES_MAX_LENGTH;
  editing = false;
  saving = false;
  draft = '';

  constructor(
    private readonly saleService: SaleService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  startEdit(): void {
    if (!this.canEdit) return;
    this.draft = this.notes ?? '';
    this.editing = true;
  }

  cancel(): void {
    this.editing = false;
  }

  save(): void {
    const notes = this.draft.trim() || null;
    this.saving = true;
    this.saleService.updateSaleNotes(this.saleId, notes).subscribe({
      next: () => {
        this.saving = false;
        this.editing = false;
        this.saved.emit(notes);
        this.cdr.markForCheck();
      },
      error: (error: { error?: { detail?: string } } | null) => {
        this.saving = false;
        this.toast.error(error?.error?.detail ?? 'No se pudieron guardar las observaciones.');
        this.cdr.markForCheck();
      }
    });
  }
}
