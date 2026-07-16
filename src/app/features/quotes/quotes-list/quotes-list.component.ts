// src/app/features/quotes/quotes-list/quotes-list.component.ts
import { Component, OnInit, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuoteService } from '../../../core/services/quote.service';
import { QuoteListItem, QuoteStatusCode } from '../../../core/models/quote.models';
import { ToastService } from '../../../shared/services/toast.service';
import { extractApiError } from '../../../shared/utils/api-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionCodes } from '../../../core/models/permission.models';

@Component({
    selector: 'app-quotes-list',
    standalone: true,
    imports: [CommonModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './quotes-list.component.html',
    styleUrls: ['./quotes-list.component.css']
})
export class QuotesListComponent implements OnInit {
    quotes: QuoteListItem[] = [];
    loading = false;
    statusFilter: QuoteStatusCode | '' = '';

    @Output() openDetail = new EventEmitter<string>();
    @Output() convertRequested = new EventEmitter<QuoteListItem>();

    constructor(
        private readonly quoteService: QuoteService,
        private readonly toast: ToastService,
        private readonly auth: AuthService,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.reload();
    }

    reload(): void {
        this.loading = true;
        this.quoteService.listQuotes(this.statusFilter ? { idQuoteStatus: this.statusFilter } : {}).subscribe({
            next: quotes => {
                this.quotes = quotes;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: err => {
                this.loading = false;
                this.toast.error(extractApiError(err, 'No se pudieron cargar los presupuestos'));
                this.cdr.markForCheck();
            }
        });
    }

    onStatusFilterChange(value: string): void {
        this.statusFilter = value ? (Number(value) as QuoteStatusCode) : '';
        this.reload();
    }

    statusLabel(quote: QuoteListItem): string {
        if (quote.idQuoteStatus === 1 && quote.isExpired) { return 'Vencido'; }
        if (quote.idQuoteStatus === 1) { return 'Pendiente'; }
        if (quote.idQuoteStatus === 2) { return 'Convertido'; }
        return 'Cancelado';
    }

    statusClass(quote: QuoteListItem): string {
        if (quote.idQuoteStatus === 1 && quote.isExpired) { return 'chip--quote-expired'; }
        if (quote.idQuoteStatus === 1) { return 'chip--quote-pending'; }
        if (quote.idQuoteStatus === 2) { return 'chip--quote-converted'; }
        return 'chip--quote-cancelled';
    }

    canConvert(quote: QuoteListItem): boolean {
        return quote.idQuoteStatus === 1 && !quote.isExpired && this.auth.hasPermission(PermissionCodes.quotesConvert);
    }

    cancelQuote(quote: QuoteListItem): void {
        this.quoteService.cancelQuote(quote.id).subscribe({
            next: () => {
                this.toast.success('Presupuesto cancelado');
                this.reload();
                this.cdr.markForCheck();
            },
            error: err => {
                this.toast.error(extractApiError(err, 'No se pudo cancelar el presupuesto'));
                this.cdr.markForCheck();
            }
        });
    }
}
