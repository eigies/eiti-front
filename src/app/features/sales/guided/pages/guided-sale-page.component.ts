import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductPickerModalComponent } from '../../../../shared/components/product-picker-modal/product-picker-modal.component';
import { SalePaymentInlineComponent } from '../../../../shared/components/sale-payment-inline/sale-payment-inline.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiAvatarComponent, UiButtonComponent, UiEmptyComponent, UiModalComponent, UiTicketComponent } from '../../../../shared/ui';
import { GuidedReviewComponent } from '../components/guided-review/guided-review.component';
import { GuidedStepperComponent } from '../components/guided-stepper/guided-stepper.component';
import { GuidedSaleFacade } from '../data-access/guided-sale.facade';
import { deliveryLabel, guidedStepTitle } from '../models/guided-sale-view';

/** Contenedor de la Venta guiada (/sales/full): pasos a la izquierda, total y avance a la derecha. */
@Component({
  selector: 'app-guided-sale-page',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    SalePaymentInlineComponent, SearchableSelectComponent, ProductPickerModalComponent,
    UiAvatarComponent, UiButtonComponent, UiEmptyComponent, UiModalComponent, UiTicketComponent,
    GuidedStepperComponent, GuidedReviewComponent
  ],
  providers: [GuidedSaleFacade],
  templateUrl: './guided-sale-page.component.html',
  styleUrls: ['./guided-sale-page.component.css']
})
export class GuidedSalePageComponent implements OnInit {
  readonly facade = inject(GuidedSaleFacade);
  readonly deliveryLabel = deliveryLabel;

  ngOnInit(): void {
    this.facade.init();
  }

  get currentTitle(): string {
    return guidedStepTitle(this.facade.stepLabels[this.facade.step - 1] ?? '');
  }

  get nextTitle(): string {
    const next = this.facade.stepLabels[this.facade.step];
    return next ? guidedStepTitle(next) : '';
  }
}
