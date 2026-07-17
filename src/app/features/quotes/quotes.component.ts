// src/app/features/quotes/quotes.component.ts
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuotesListComponent } from './quotes-list/quotes-list.component';
import { QuoteFormComponent } from './quote-form/quote-form.component';
import { QuoteDetailModalComponent } from './quote-detail-modal/quote-detail-modal.component';
import { QuoteListItem, QuoteDetailResponse } from '../../core/models/quote.models';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
    selector: 'app-quotes',
    standalone: true,
    imports: [CommonModule, QuotesListComponent, QuoteFormComponent, QuoteDetailModalComponent],
    templateUrl: './quotes.component.html',
    styleUrls: ['./quotes.component.css']
})
export class QuotesComponent {
    showForm = false;
    detailQuoteId: string | null = null;

    @ViewChild(QuotesListComponent) private readonly list?: QuotesListComponent;

    constructor(
        private readonly router: Router,
        private readonly auth: AuthService,
        private readonly toast: ToastService
    ) {}

    onCreated(): void {
        this.showForm = false;
        this.list?.reload();
    }

    openDetail(id: string): void {
        this.detailQuoteId = id;
    }

    closeDetail(): void {
        this.detailQuoteId = null;
    }

    convertQuote(quote: QuoteDetailResponse | QuoteListItem): void {
        this.detailQuoteId = null;

        // quote-detail-modal's "Convertir" button doesn't check quotesConvert itself
        // (unlike quotes-list, which gates its own button via canConvert()).
        // Defensive check here so navigation never happens without the permission,
        // regardless of which child component triggered it.
        if (!this.auth.hasPermission(PermissionCodes.quotesConvert)) {
            this.toast.error('No tenes permiso para convertir presupuestos');
            return;
        }

        this.router.navigateByUrl('/sales-cc', {
            state: {
                quotePrefill: {
                    quoteId: quote.id,
                    branchId: quote.branchId,
                    customerId: 'customerId' in quote ? quote.customerId : null,
                    customerFullName: 'customerFullName' in quote ? quote.customerFullName : null,
                    prospectName: 'prospectName' in quote ? quote.prospectName : null,
                    generalDiscountPercent: 'generalDiscountPercent' in quote ? quote.generalDiscountPercent : 0,
                    details: 'details' in quote
                        ? quote.details.map(detail => ({
                            productId: detail.productId,
                            productName: detail.productName,
                            productBrand: detail.productBrand,
                            quantity: detail.quantity,
                            unitPrice: detail.unitPrice,
                            discountPercent: detail.discountPercent
                        }))
                        : []
                }
            }
        });
    }
}
