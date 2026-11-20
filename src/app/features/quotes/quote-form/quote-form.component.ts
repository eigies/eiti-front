import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ProductPickerModalComponent } from '../../../shared/components/product-picker-modal/product-picker-modal.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTableWrapComponent, UiTicketComponent } from '../../../shared/ui';
import { QuoteFormFacade } from '../data-access/quote-form.facade';

/**
 * Nuevo presupuesto como pantalla propia: sucursal y vencimiento arriba, cliente o prospecto,
 * productos con precio y descuento editables y, a la derecha, el total en el ticket.
 */
@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ProductPickerModalComponent, SearchableSelectComponent,
    UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTableWrapComponent, UiTicketComponent
  ],
  providers: [QuoteFormFacade],
  templateUrl: './quote-form.component.html',
  styleUrls: ['./quote-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteFormComponent implements OnInit {
  @Output() created = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  readonly facade = inject(QuoteFormFacade);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.facade.created.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.created.emit());
    this.facade.init();
  }
}
