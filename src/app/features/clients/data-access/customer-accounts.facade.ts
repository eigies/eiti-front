import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerAccountService } from '../../../core/services/customer-account.service';
import { CustomerAccountListItem } from '../../../core/models/customer-account.models';
import { ToastService } from '../../../shared/services/toast.service';

/** Estado del listado de cuentas corrientes. Movido tal cual desde CustomerAccountsComponent. */
@Injectable()
export class CustomerAccountsFacade {
  accounts: CustomerAccountListItem[] = [];
  loading = true;
  search = '';

  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly toast: ToastService,
    private readonly router: Router
  ) {}

  load(): void {
    this.loading = true;
    this.customerAccountService.listCustomerAccounts().subscribe({
      next: accounts => {
        this.accounts = accounts;
        this.loading = false;
      },
      error: () => {
        this.toast.error('No se pudieron cargar las cuentas de clientes');
        this.loading = false;
      }
    });
  }

  applySearch(): void {
    // El listado no tiene búsqueda server-side: filtramos en cliente.
  }

  clearSearch(): void {
    this.search = '';
  }

  get filteredAccounts(): CustomerAccountListItem[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.accounts;
    return this.accounts.filter(a =>
      a.name.toLowerCase().includes(term) ||
      (a.phone ?? '').toLowerCase().includes(term) ||
      (a.documentNumber ?? '').toLowerCase().includes(term) ||
      (a.taxId ?? '').toLowerCase().includes(term)
    );
  }

  get conDeuda(): number {
    return this.filteredAccounts.filter(a => a.saldoPendiente > 0).length;
  }

  openAccount(customerId: string): void {
    this.router.navigate(['/clients-cc/customer', customerId]);
  }
}
