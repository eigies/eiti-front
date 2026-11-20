import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiAvatarComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent } from '../../../../shared/ui';
import { ReportChip, ReportChipDef, ReportFiltersComponent, clearReportFilter, reportChips } from '../../shared';
import { DebtorsReportFacade } from '../data-access/debtors-report.facade';
import { debtAgeBadge, debtAgeDays } from '../models/debt-age';

/** Contenedor de Clientes deudores (plantilla B): neto a cobrar en el ticket y antigüedad con color. */
@Component({
  selector: 'app-debtors-report-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiAvatarComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, UiTicketComponent, ReportFiltersComponent],
  providers: [DebtorsReportFacade],
  templateUrl: './debtors-report-page.component.html',
  styleUrls: ['../../reports.shared.css']
})
export class DebtorsReportPageComponent implements OnInit {
  readonly facade = inject(DebtorsReportFacade);
  readonly ageDays = debtAgeDays;
  readonly ageBadge = debtAgeBadge;

  ngOnInit(): void {
    this.facade.init();
  }

  private get chipDefs(): ReportChipDef[] {
    return [
      { key: 'branchId', label: 'Sucursal', options: this.facade.branchOptions },
      { key: 'customerId', label: 'Cliente', options: this.facade.customerOptions }
    ];
  }

  get chips(): ReportChip[] {
    return reportChips(this.facade.filterForm, this.chipDefs);
  }

  get openSales(): number {
    return (this.facade.data?.rows ?? []).reduce((sum, row) => sum + row.openSalesCount, 0);
  }

  removeChip(key: string): void {
    clearReportFilter(this.facade.filterForm, this.chipDefs, key);
    this.facade.load();
  }
}
