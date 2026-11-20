import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { DiscountsReportFacade } from '../data-access/discounts-report.facade';

/** Contenedor de Descuentos en ventas (plantilla B): lo descontado en el ticket y cada venta con quién lo aplicó. */
@Component({
  selector: 'app-discounts-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [DiscountsReportFacade],
  templateUrl: './discounts-report-page.component.html',
  styleUrls: ['../../reports.shared.css', './discounts-report-page.component.css']
})
export class DiscountsReportPageComponent implements OnInit {
  readonly facade = inject(DiscountsReportFacade);

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    const f = this.facade;
    return [
      { key: 'branchId', label: 'Sucursal', options: f.branchOptions },
      { key: 'customerId', label: 'Cliente', options: f.customerOptions },
      { key: 'saleType', label: 'Tipo de venta', options: f.saleTypeOptions, empty: 'all' },
      { key: 'userId', label: 'Aplicado por', options: f.userOptions }
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
