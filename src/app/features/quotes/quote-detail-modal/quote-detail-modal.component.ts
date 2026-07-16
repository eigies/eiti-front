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
import { QuoteDetailResponse } from '../../../core/models/quote.models';
import { generateQuotePdf } from '../../../shared/utils/quote-pdf.util';
import { ToastService } from '../../../shared/services/toast.service';
import { extractApiError } from '../../../shared/utils/api-error.util';

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

    constructor(
        private readonly quoteService: QuoteService,
        private readonly toast: ToastService,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnChanges(): void {
        if (!this.quoteId) { return; }
        this.loading = true;
        this.quoteService.getQuoteById(this.quoteId).subscribe({
            next: quote => {
                this.quote = quote;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: err => {
                this.loading = false;
                this.toast.error(extractApiError(err, 'No se pudo cargar el presupuesto'));
                this.cdr.markForCheck();
            }
        });
    }

    get canConvert(): boolean {
        return !!this.quote && this.quote.idQuoteStatus === 1 && !this.quote.isExpired;
    }

    downloadPdf(): void {
        if (this.quote) { generateQuotePdf(this.quote); }
    }

    requestConvert(): void {
        if (this.quote && this.canConvert) { this.convert.emit(this.quote); }
    }
}
