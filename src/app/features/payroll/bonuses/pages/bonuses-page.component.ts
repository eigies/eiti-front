import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { PayrollBonusResponse } from '../../../../core/models/payroll.models';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../../shared/ui';
import { BonusFormModalComponent } from '../components/bonus-form-modal/bonus-form-modal.component';
import { BonusListComponent } from '../components/bonus-list/bonus-list.component';
import { BonusesFacade } from '../data-access/bonuses.facade';

/** Contenedor de /payroll/bonuses: filtros, tabla y alta en popup. */
@Component({
  selector: 'app-bonuses-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, BonusListComponent, BonusFormModalComponent],
  providers: [BonusesFacade],
  templateUrl: './bonuses-page.component.html',
  styleUrls: ['../../advances/pages/advances-page.component.css']
})
export class BonusesPageComponent implements OnInit {
  readonly facade = inject(BonusesFacade);
  readonly nameOf = (id: string): string => this.facade.employeeName(id);
  readonly conceptOf = (id: string): string => this.facade.conceptName(id);
  readonly amountOf = (bonus: PayrollBonusResponse): string => this.facade.amountLabel(bonus);
  readonly statusOf = (status: number): string => this.facade.statusLabel(status);
  readonly badgeOf = (status: number): string => this.facade.statusBadgeClass(status);

  ngOnInit(): void {
    this.facade.init();
  }
}
