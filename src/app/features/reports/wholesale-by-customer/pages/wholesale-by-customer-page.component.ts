import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { MarginBarComponent, ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { WholesaleByCustomerFacade } from '../data-access/wholesale-by-customer.facade';

/** Contenedor de Ventas por cliente (plantilla B): ganancia en el ticket y cada cliente con su margen. */
@Component({
  selector: 'app-wholesale-by-customer-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent, MarginBarComponent],
  providers: [WholesaleByCustomerFacade],
  templateUrl: './wholesale-by-customer-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class WholesaleByCustomerPageComponent implements OnInit {
  readonly facade = inject(WholesaleByCustomerFacade);

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    return [
      { key: 'customerId', label: 'Cliente', options: this.facade.customerOptions },
      { key: 'branchId', label: 'Sucursal', options: this.facade.branchOptions }
    ];
  }

  get chips(): ReportChip[] {
    return reportChips(this.facade.filterForm, this.chipDefs);
  }

  removeChip(key: string): void {
    clearReportFilter(this.facade.filterForm, this.chipDefs, key);
    this.facade.search();
  }
}
