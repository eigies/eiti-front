import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { ComparisonReportFacade } from '../data-access/comparison-report.facade';

/** Contenedor del Comparativo (plantilla B): ganancia del período B en el ticket y la variación de cada métrica. */
@Component({
  selector: 'app-comparison-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [ComparisonReportFacade],
  templateUrl: './comparison-report-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class ComparisonReportPageComponent implements OnInit {
  readonly facade = inject(ComparisonReportFacade);

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

  /** Variación de una métrica (en % o en puntos para el margen). */
  delta(label: string): number | null {
    return this.facade.rows.find(row => row.label === label)?.delta ?? null;
  }

  trackLabel(_: number, row: { label: string }): string {
    return row.label;
  }

  removeChip(key: string): void {
    clearReportFilter(this.facade.filterForm, this.chipDefs, key);
    this.facade.search();
  }
}
