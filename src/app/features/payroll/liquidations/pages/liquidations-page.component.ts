import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../../shared/ui';
import { GenerateLiquidationsModalComponent } from '../components/generate-liquidations-modal/generate-liquidations-modal.component';
import { LiquidationListComponent } from '../components/liquidation-list/liquidation-list.component';
import { PayLiquidationModalComponent } from '../components/pay-liquidation-modal/pay-liquidation-modal.component';
import { LiquidationReceiptPdfService } from '../data-access/liquidation-receipt-pdf.service';
import { LiquidationsFacade } from '../data-access/liquidations.facade';

/** Contenedor de /payroll/liquidations: filtros, listado con detalle que se abre y popups de generar y pagar. */
@Component({
  selector: 'app-liquidations-page',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent,
    LiquidationListComponent, GenerateLiquidationsModalComponent, PayLiquidationModalComponent
  ],
  providers: [LiquidationsFacade, LiquidationReceiptPdfService],
  templateUrl: './liquidations-page.component.html',
  styleUrls: ['./liquidations-page.component.css']
})
export class LiquidationsPageComponent implements OnInit {
  readonly facade = inject(LiquidationsFacade);
  readonly nameOf = (id: string): string => this.facade.employeeName(id);
  readonly statusOf = (status: number): string => this.facade.statusLabel(status);
  readonly methodOf = (method: number | null): string => this.facade.paymentMethodLabel(method);
  readonly totalOf = (lines: Array<{ amount: number }>): number => this.facade.lineTotal(lines);

  ngOnInit(): void {
    this.facade.init();
  }
}
