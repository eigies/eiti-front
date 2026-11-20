import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AccountLedgerComponent } from '../../../shared/components/account-ledger/account-ledger.component';
import { GroupedPaymentModalComponent } from '../../../shared/components/grouped-payment-modal/grouped-payment-modal.component';
import { UiAvatarComponent, UiButtonComponent } from '../../../shared/ui';
import { CustomerAccountFacade } from '../data-access/customer-account.facade';
import { AccountSummaryComponent } from '../../../shared/components/account-summary/account-summary.component';
import { CancelCcSaleModalComponent } from '../components/cancel-cc-sale-modal/cancel-cc-sale-modal.component';
import { CcSaleDetailFlags, CcSaleDetailModalComponent } from '../components/cc-sale-detail-modal/cc-sale-detail-modal.component';
import { AccountCreditNoteModalComponent } from '../../../shared/components/account-credit-note-modal/account-credit-note-modal.component';

/** Contenedor de /clients-cc/customer/:customerId: cuenta corriente de un cliente. */
@Component({
  selector: 'app-customer-account-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, UiAvatarComponent, UiButtonComponent, AccountLedgerComponent, GroupedPaymentModalComponent,
    AccountSummaryComponent, AccountCreditNoteModalComponent, CcSaleDetailModalComponent, CancelCcSaleModalComponent
  ],
  providers: [CustomerAccountFacade],
  templateUrl: './customer-account-page.component.html',
  styleUrls: ['./customer-account-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerAccountPageComponent implements OnInit {
  readonly facade = inject(CustomerAccountFacade);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.facade.init(this.route.snapshot.paramMap.get('customerId') ?? '');
  }

  get detailFlags(): CcSaleDetailFlags {
    const f = this.facade;
    return {
      canDownloadPriced: f.auth.hasPermission(f.permissionCodes.salesRemitoAmounts),
      canDownloadInvoice: f.canDownloadDetalleInvoice,
      canDownloadCreditNote: f.canDownloadDetalleCreditNote,
      canDownloadDebitNote: f.canDownloadDetalleDebitNote,
      canEditNotes: f.canEditDetalleNotes,
      canCancel: f.canCancelDetalleSale,
      hasDiscount: f.detalleHasDiscount
    };
  }
}
