import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { QuoteListItem } from '../../../../core/models/quote.models';
import { UiButtonComponent, UiTableWrapComponent } from '../../../../shared/ui';

/** Presupuestos con estado de color: pendiente ámbar, vencido rojo, convertido verde, cancelado gris. */
@Component({
  selector: 'app-quotes-table',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiTableWrapComponent],
  templateUrl: './quotes-table.component.html',
  styleUrls: ['./quotes-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuotesTableComponent {
  @Input() quotes: QuoteListItem[] = [];
  @Input() canConvertFn: (quote: QuoteListItem) => boolean = () => false;
  @Output() open = new EventEmitter<string>();
  @Output() convert = new EventEmitter<QuoteListItem>();
  @Output() cancel = new EventEmitter<QuoteListItem>();

  statusLabel(quote: QuoteListItem): string {
    if (quote.idQuoteStatus === 1 && quote.isExpired) { return 'Vencido'; }
    if (quote.idQuoteStatus === 1) { return 'Pendiente'; }
    if (quote.idQuoteStatus === 2) { return 'Convertido'; }
    return 'Cancelado';
  }

  statusClass(quote: QuoteListItem): string {
    if (quote.idQuoteStatus === 1 && quote.isExpired) { return 'ui-badge--danger'; }
    if (quote.idQuoteStatus === 1) { return 'ui-badge--brand'; }
    if (quote.idQuoteStatus === 2) { return 'ui-badge--success'; }
    return '';
  }
}
