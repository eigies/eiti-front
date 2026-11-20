import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ChequeListItem, ChequeOrigen } from '../../../core/models/cheque.models';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../shared/ui';
import { ChequesFacade } from '../data-access/cheques.facade';
import { ChequeDetailModalComponent } from '../components/cheque-detail-modal/cheque-detail-modal.component';
import { ChequesTableComponent } from '../components/cheques-table/cheques-table.component';

/** Contenedor de /cheques: monto visible en el ticket, filtros en una franja, listado y detalle. */
@Component({
  selector: 'app-cheques-page',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent,
    UiTicketComponent, ChequesTableComponent, ChequeDetailModalComponent
  ],
  providers: [ChequesFacade],
  templateUrl: './cheques-page.component.html',
  styleUrls: ['./cheques-page.component.css']
})
export class ChequesPageComponent implements OnInit {
  readonly facade = inject(ChequesFacade);
  readonly origen = ChequeOrigen;
  readonly isUrgent = (c: ChequeListItem): boolean => this.facade.isUrgent(c);
  readonly urgencyLabel = (c: ChequeListItem): string => this.facade.urgencyLabel(c);
  readonly dateLabel = (value: string): string => this.facade.dateLabel(value);

  ngOnInit(): void {
    this.facade.init();
  }

  get origenValue(): number | null {
    return this.facade.filterForm.value.origen ?? null;
  }

  setOrigen(value: number | null): void {
    this.facade.filterForm.patchValue({ origen: value });
    this.facade.applyFilters();
  }
}
