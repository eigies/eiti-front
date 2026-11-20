import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { TradeInsByBranchFacade } from '../data-access/trade-ins-by-branch.facade';

/** Contenedor de Canjes por sucursal (plantilla B): valor reconocido en el ticket y el detalle por producto. */
@Component({
  selector: 'app-trade-ins-by-branch-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [TradeInsByBranchFacade],
  templateUrl: './trade-ins-by-branch-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class TradeInsByBranchPageComponent implements OnInit {
  readonly facade = inject(TradeInsByBranchFacade);

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
