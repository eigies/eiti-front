import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiMovPillComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { StockMovementsReportFacade } from '../data-access/stock-movements-report.facade';
import { TransferDetailModalComponent } from '../components/transfer-detail-modal/transfer-detail-modal.component';

/** Contenedor de Movimientos de stock (plantilla B). Sin importes: no lleva ticket. */
@Component({
  selector: 'app-stock-movements-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiMovPillComponent, ReportFiltersComponent, TransferDetailModalComponent],
  providers: [StockMovementsReportFacade],
  templateUrl: './stock-movements-page.component.html',
  styleUrls: ['../../reports.shared.css', './stock-movements-page.component.css']
})
export class StockMovementsPageComponent implements OnInit {
  readonly facade = inject(StockMovementsReportFacade);
  moreOpen = false;

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    const f = this.facade;
    return [
      { key: 'productId', label: 'Modelo', options: f.productOptions },
      { key: 'branchId', label: 'Sucursal', options: f.branchOptions },
      { key: 'type', label: 'Tipo', options: f.typeOptions }
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
