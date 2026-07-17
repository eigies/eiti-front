// src/app/features/quotes/quote-detail-modal/quote-detail-modal.component.ts
import {
    Component,
    Input,
    OnChanges,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
    ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuoteService } from '../../../core/services/quote.service';
import { StockService } from '../../../core/services/stock.service';
import { QuoteDetailResponse } from '../../../core/models/quote.models';
import { generateQuotePdf } from '../../../shared/utils/quote-pdf.util';
import { ToastService } from '../../../shared/services/toast.service';
import { extractApiError } from '../../../shared/utils/api-error.util';

export interface QuoteStockWarning {
    productId: string;
    productLabel: string;
    quoted: number;
    available: number;
}

@Component({
    selector: 'app-quote-detail-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './quote-detail-modal.component.html',
    styleUrls: ['./quote-detail-modal.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteDetailModalComponent implements OnChanges {
    @Input({ required: true }) quoteId!: string;
    @Output() close = new EventEmitter<void>();
    @Output() convert = new EventEmitter<QuoteDetailResponse>();

    quote: QuoteDetailResponse | null = null;
    loading = false;

    private availableByProductId = new Map<string, number>();
    stockWarnings: QuoteStockWarning[] = [];

    constructor(
        private readonly quoteService: QuoteService,
        private readonly stockService: StockService,
        private readonly toast: ToastService,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnChanges(): void {
        if (!this.quoteId) { return; }
        this.loading = true;
        this.quote = null;
        this.stockWarnings = [];
        this.quoteService.getQuoteById(this.quoteId).subscribe({
            next: quote => {
                this.quote = quote;
                this.loading = false;
                this.cdr.markForCheck();
                this.loadStockWarnings(quote);
            },
            error: err => {
                this.loading = false;
                this.toast.error(extractApiError(err, 'No se pudo cargar el presupuesto'));
                this.cdr.markForCheck();
            }
        });
    }

    // El presupuesto no reserva stock: acá solo comparamos contra el stock ACTUAL de la
    // sucursal para avisarle al vendedor si algo cambió desde que se cotizó (nunca bloquea).
    private loadStockWarnings(quote: QuoteDetailResponse): void {
        this.stockService.listBranchStock(quote.branchId).subscribe({
            next: stockItems => {
                this.availableByProductId = new Map(stockItems.map(item => [item.productId, item.availableQuantity]));
                this.stockWarnings = quote.details
                    .map(detail => ({
                        productId: detail.productId,
                        productLabel: `${detail.productBrand} ${detail.productName}`.trim(),
                        quoted: detail.quantity,
                        available: this.availableByProductId.get(detail.productId) ?? 0
                    }))
                    .filter(warning => warning.available < warning.quoted);
                this.cdr.markForCheck();
            },
            error: () => {
                // No bloquea la vista del presupuesto si falla la consulta de stock; simplemente no se muestran avisos.
                this.cdr.markForCheck();
            }
        });
    }

    hasStockIssue(productId: string): boolean {
        return this.stockWarnings.some(warning => warning.productId === productId);
    }

    stockIssueFor(productId: string): QuoteStockWarning | undefined {
        return this.stockWarnings.find(warning => warning.productId === productId);
    }

    get canConvert(): boolean {
        return !!this.quote && this.quote.idQuoteStatus === 1 && !this.quote.isExpired;
    }

    get statusLabel(): string {
        if (!this.quote) { return ''; }
        if (this.quote.idQuoteStatus === 1 && this.quote.isExpired) { return 'Vencido'; }
        if (this.quote.idQuoteStatus === 1) { return 'Pendiente'; }
        if (this.quote.idQuoteStatus === 2) { return 'Convertido'; }
        return 'Cancelado';
    }

    get statusBadgeClass(): string {
        if (!this.quote) { return ''; }
        if (this.quote.idQuoteStatus === 1 && this.quote.isExpired) { return 'badge--expired'; }
        if (this.quote.idQuoteStatus === 1) { return 'badge--pending'; }
        if (this.quote.idQuoteStatus === 2) { return 'badge--paid'; }
        return 'badge--cancelled';
    }

    get hasDiscount(): boolean {
        if (!this.quote) { return false; }
        return this.quote.generalDiscountPercent > 0 || this.quote.details.some(detail => detail.discountPercent > 0);
    }

    get subtotal(): number {
        if (!this.quote) { return 0; }
        return this.quote.details.reduce((sum, detail) => sum + detail.lineTotal, 0);
    }

    downloadPdf(): void {
        if (this.quote) { generateQuotePdf(this.quote); }
    }

    requestConvert(): void {
        if (this.quote && this.canConvert) { this.convert.emit(this.quote); }
    }
}
