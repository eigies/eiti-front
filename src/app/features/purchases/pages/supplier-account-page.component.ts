import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AccountCreditNoteModalComponent } from '../../../shared/components/account-credit-note-modal/account-credit-note-modal.component';
import { AccountLedgerComponent } from '../../../shared/components/account-ledger/account-ledger.component';
import { AccountSummaryComponent } from '../../../shared/components/account-summary/account-summary.component';
import { GroupedPaymentModalComponent } from '../../../shared/components/grouped-payment-modal/grouped-payment-modal.component';
import { UiAvatarComponent, UiButtonComponent } from '../../../shared/ui';
import { SupplierAccountFacade } from '../data-access/supplier-account.facade';

/** Contenedor de la cuenta corriente de un proveedor: mismas piezas que la cuenta de clientes. */
@Component({
  selector: 'app-supplier-account-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, UiAvatarComponent, UiButtonComponent, AccountSummaryComponent,
    AccountCreditNoteModalComponent, AccountLedgerComponent, GroupedPaymentModalComponent
  ],
  providers: [SupplierAccountFacade],
  templateUrl: './supplier-account-page.component.html',
  styleUrls: ['../../clients/pages/customer-account-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierAccountPageComponent implements OnInit {
  readonly facade = inject(SupplierAccountFacade);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.facade.init(this.route.snapshot.paramMap.get('supplierId') ?? '');
  }
}
