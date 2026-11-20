import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { MarginBarComponent, ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { PaymentMethodsReportFacade } from '../data-access/payment-methods-report.facade';

/** Contenedor de Cobros por medio de pago (plantilla B): total cobrado en el ticket y el peso de cada medio. */
@Component({
  selector: 'app-payment-methods-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent, MarginBarComponent],
  providers: [PaymentMethodsReportFacade],
  templateUrl: './payment-methods-report-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class PaymentMethodsReportPageComponent implements OnInit {
  readonly facade = inject(PaymentMethodsReportFacade);
  moreOpen = false;

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    return [
      { key: 'branchId', label: 'Sucursal', options: this.facade.branchOptions },
      { key: 'saleType', label: 'Tipo de venta', options: this.facade.saleTypeOptions, empty: 'all' },
      { key: 'customerId', label: 'Cliente', options: this.facade.customerOptions }
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
