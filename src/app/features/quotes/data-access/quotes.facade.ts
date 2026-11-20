import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionCodes } from '../../../core/models/permission.models';
import { QuoteDetailResponse, QuoteListItem, QuoteStatusCode } from '../../../core/models/quote.models';
import { AuthService } from '../../../core/services/auth.service';
import { QuoteService } from '../../../core/services/quote.service';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ToastService } from '../../../shared/services/toast.service';
import { extractApiError } from '../../../shared/utils/api-error.util';

/**
 * Estado de la pantalla de presupuestos: listado, filtro de estado, alta, detalle y conversión.
 * Movido tal cual desde QuotesComponent y QuotesListComponent.
 */
@Injectable()
export class QuotesFacade {
  showForm = false;
  detailQuoteId: string | null = null;

  quotes: QuoteListItem[] = [];
  loading = false;
  statusFilter: QuoteStatusCode | null = null;

  readonly statusOptions: SearchableSelectOption[] = [
    { value: null, label: 'Todos' },
    { value: 1, label: 'Pendiente' },
    { value: 2, label: 'Convertido' },
    { value: 3, label: 'Cancelado' }
  ];

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly quoteService: QuoteService
  ) {}

  reload(): void {
    this.loading = true;
    this.quoteService.listQuotes(this.statusFilter ? { idQuoteStatus: this.statusFilter } : {}).subscribe({
      next: quotes => {
        this.quotes = quotes;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.toast.error(extractApiError(err, 'No se pudieron cargar los presupuestos'));
      }
    });
  }

  setStatusFilter(status: QuoteStatusCode | null): void {
    this.statusFilter = status;
    this.onStatusFilterChange();
  }

  onStatusFilterChange(): void {
    this.reload();
  }

  canConvert(quote: QuoteListItem): boolean {
    return quote.idQuoteStatus === 1 && !quote.isExpired && this.auth.hasPermission(PermissionCodes.quotesConvert);
  }

  cancelQuote(quote: QuoteListItem): void {
    this.quoteService.cancelQuote(quote.id).subscribe({
      next: () => {
        this.toast.success('Presupuesto cancelado');
        this.reload();
      },
      error: err => {
        this.toast.error(extractApiError(err, 'No se pudo cancelar el presupuesto'));
      }
    });
  }

  onCreated(): void {
    this.showForm = false;
    this.reload();
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

    // quotes-list's "Convertir" button only carries a QuoteListItem (no `details`,
    // no `generalDiscountPercent`) - always refetch the full quote so the sales-cc
    // prefill has real line items regardless of which child triggered the conversion.
    this.quoteService.getQuoteById(quote.id).subscribe({
      next: fullQuote => this.navigateToConversion(fullQuote),
      error: err => this.toast.error(extractApiError(err, 'No se pudo cargar el presupuesto para convertir'))
    });
  }

  private navigateToConversion(quote: QuoteDetailResponse): void {
    this.router.navigateByUrl('/sales-cc', {
      state: {
        quotePrefill: {
          quoteId: quote.id,
          code: quote.code,
          branchId: quote.branchId,
          customerId: quote.customerId,
          customerFullName: quote.customerFullName,
          prospectName: quote.prospectName,
          generalDiscountPercent: quote.generalDiscountPercent,
          vatRate: quote.vatRate,
          includesVat: quote.includesVat,
          details: quote.details.map(detail => ({
            productId: detail.productId,
            productName: detail.productName,
            productBrand: detail.productBrand,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
            discountPercent: detail.discountPercent
          }))
        }
      }
    });
  }
}
