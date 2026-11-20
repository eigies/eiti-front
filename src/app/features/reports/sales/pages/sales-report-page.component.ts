import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { MarginBarComponent, ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { SalesReportFacade } from '../data-access/sales-report.facade';

/** Contenedor de los reportes de ventas (plantilla B): filtros, totales arriba, tabla con margen y notas. */
@Component({
  selector: 'app-sales-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent, MarginBarComponent],
  providers: [SalesReportFacade],
  templateUrl: './sales-report-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class SalesReportPageComponent implements OnInit {
  readonly facade = inject(SalesReportFacade);

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    const f = this.facade;
    return [
      { key: 'customerId', label: 'Cliente', options: f.customerOptions },
      { key: 'installerId', label: 'Instalador', options: f.driverOptions },
      { key: 'vehicleId', label: 'Vehículo', options: f.vehicleOptions },
      { key: 'channel', label: 'Canal', options: f.channelOptions },
      { key: 'categoryId', label: 'Categoría', options: f.categoryOptions },
      { key: 'branchId', label: 'Sucursal', options: f.branchOptions },
      { key: 'deliveryMode', label: 'Envío', options: f.deliveryOptions, empty: 'all' },
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
