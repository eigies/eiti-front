import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { PayrollAdvanceResponse } from '../../../../core/models/payroll.models';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../../shared/ui';
import { AdvanceFormModalComponent } from '../components/advance-form-modal/advance-form-modal.component';
import { AdvanceListComponent } from '../components/advance-list/advance-list.component';
import { AdvancesFacade } from '../data-access/advances.facade';

/** Contenedor de /payroll/advances: filtros, tabla y alta en popup. */
@Component({
  selector: 'app-advances-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, AdvanceListComponent, AdvanceFormModalComponent],
  providers: [AdvancesFacade],
  templateUrl: './advances-page.component.html',
  styleUrls: ['./advances-page.component.css']
})
export class AdvancesPageComponent implements OnInit {
  readonly facade = inject(AdvancesFacade);
  readonly nameOf = (id: string): string => this.facade.employeeName(id);
  readonly statusOf = (status: number): string => this.facade.statusLabel(status);
  readonly badgeOf = (status: number): string => this.facade.statusBadgeClass(status);
  readonly payOf = (advance: PayrollAdvanceResponse): string => this.facade.wasCash(advance);

  ngOnInit(): void {
    this.facade.init();
  }
}
