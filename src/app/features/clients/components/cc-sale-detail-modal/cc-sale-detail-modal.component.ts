import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SaleByIdResponse, SaleFiscalDocumentKind } from '../../../../core/models/sale.models';
import { SaleNotesComponent } from '../../../../shared/components/sale-notes/sale-notes.component';
import { UiButtonComponent, UiModalComponent, UiReceiptComponent } from '../../../../shared/ui';

export interface CcSaleDetailFlags {
  canDownloadPriced: boolean;
  canDownloadInvoice: boolean;
  canDownloadCreditNote: boolean;
  canDownloadDebitNote: boolean;
  canEditNotes: boolean;
  canCancel: boolean;
  hasDiscount: boolean;
}

/** Detalle de una venta de cuenta corriente con forma de recibo. */
@Component({
  selector: 'app-cc-sale-detail-modal',
  standalone: true,
  imports: [CommonModule, SaleNotesComponent, UiModalComponent, UiButtonComponent, UiReceiptComponent],
  templateUrl: './cc-sale-detail-modal.component.html',
  styleUrls: ['./cc-sale-detail-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CcSaleDetailModalComponent {
  @Input() sale: SaleByIdResponse | null = null;
  @Input() loading = false;
  @Input() statusLabel = '';
  @Input() statusClass = '';
  @Input({ required: true }) flags!: CcSaleDetailFlags;
  @Input() canceling = false;
  @Input() escapeCloses = true;
  @Output() closed = new EventEmitter<void>();
  @Output() downloadPriced = new EventEmitter<void>();
  @Output() downloadRemito = new EventEmitter<void>();
  @Output() downloadFiscal = new EventEmitter<SaleFiscalDocumentKind>();
  @Output() downloadReceipts = new EventEmitter<void>();
  @Output() notesSaved = new EventEmitter<string | null>();
  @Output() cancelSale = new EventEmitter<void>();

  get badge(): string {
    switch (this.statusClass) {
      case 'badge--paid': return 'ui-badge--success';
      case 'badge--partial': return 'ui-badge--info';
      case 'badge--pending': return 'ui-badge--warning';
      default: return '';
    }
  }

  get heading(): string {
    if (this.sale) return `${this.sale.code || 'S/N'} · ${this.sale.customerFullName || 'Sin cliente'}`;
    return this.loading ? 'Cargando...' : '';
  }
}
