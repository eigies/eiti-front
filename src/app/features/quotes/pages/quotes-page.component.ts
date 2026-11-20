import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { QuoteListItem, QuoteStatusCode } from '../../../core/models/quote.models';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { QuotesFacade } from '../data-access/quotes.facade';
import { QuoteDetailModalComponent } from '../quote-detail-modal/quote-detail-modal.component';
import { QuoteFormComponent } from '../quote-form/quote-form.component';
import { QuotesTableComponent } from '../components/quotes-table/quotes-table.component';

/** Contenedor de /quotes: listado con filtro de estado en pestañas, nuevo presupuesto y detalle. */
@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiCardComponent, UiEmptyComponent, QuotesTableComponent, QuoteFormComponent, QuoteDetailModalComponent],
  providers: [QuotesFacade],
  templateUrl: './quotes-page.component.html',
  styleUrls: ['./quotes-page.component.css']
})
export class QuotesPageComponent implements OnInit {
  readonly facade = inject(QuotesFacade);
  readonly canConvert = (quote: QuoteListItem): boolean => this.facade.canConvert(quote);

  ngOnInit(): void {
    this.facade.reload();
  }

  isTab(value: unknown): boolean {
    return this.facade.statusFilter === value;
  }

  selectTab(value: unknown): void {
    this.facade.setStatusFilter(value as QuoteStatusCode | null);
  }
}
