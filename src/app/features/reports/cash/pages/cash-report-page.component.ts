import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { CashReportFacade } from '../data-access/cash-report.facade';

/** Contenedor de Caja por motivo (plantilla B): total en el ticket y cada motivo con su detalle que se abre. */
@Component({
  selector: 'app-cash-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [CashReportFacade],
  templateUrl: './cash-report-page.component.html',
  styleUrls: ['../../reports.shared.css', './cash-report-page.component.css']
})
export class CashReportPageComponent implements OnInit {
  readonly facade = inject(CashReportFacade);

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    return [{ key: 'branchId', label: 'Sucursal', options: this.facade.branchOptions }];
  }

  get chips(): ReportChip[] {
    return reportChips(this.facade.filterForm, this.chipDefs);
  }

  get movementCount(): number {
    return (this.facade.data?.categories ?? []).reduce((sum, cat) => sum + cat.count, 0);
  }

  removeChip(key: string): void {
    clearReportFilter(this.facade.filterForm, this.chipDefs, key);
    this.facade.search();
  }
}
