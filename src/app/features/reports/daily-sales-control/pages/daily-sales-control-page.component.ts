import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { DailySalesControlFacade } from '../data-access/daily-sales-control.facade';

/** Contenedor del Control diario de ventas (plantilla B): total en el ticket y el detalle de cada venta. */
@Component({
  selector: 'app-daily-sales-control-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [DailySalesControlFacade],
  templateUrl: './daily-sales-control-page.component.html',
  styleUrls: ['../../reports.shared.css', './daily-sales-control-page.component.css']
})
export class DailySalesControlPageComponent implements OnInit {
  readonly facade = inject(DailySalesControlFacade);
  moreOpen = false;

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    const f = this.facade;
    return [
      { key: 'branchId', label: 'Sucursal', options: f.branchOptions },
      { key: 'customerId', label: 'Cliente', options: f.customerOptions },
      { key: 'saleType', label: 'Tipo de venta', options: f.saleTypeOptions, empty: 'all' }
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
