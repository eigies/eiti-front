import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { CustomerAccountsFacade } from '../data-access/customer-accounts.facade';
import { AccountListTableComponent } from '../components/account-list-table/account-list-table.component';

/** Contenedor de /clients-cc: listado de cuentas corrientes. */
@Component({
  selector: 'app-customer-accounts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiCardComponent, UiEmptyComponent, AccountListTableComponent],
  providers: [CustomerAccountsFacade],
  templateUrl: './customer-accounts-page.component.html',
  styleUrls: ['./customer-accounts-page.component.css']
})
export class CustomerAccountsPageComponent implements OnInit {
  readonly facade = inject(CustomerAccountsFacade);

  ngOnInit(): void {
    this.facade.load();
  }
}
