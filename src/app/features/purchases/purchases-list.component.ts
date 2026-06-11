import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupplierAccountService } from '../../core/services/supplier-account.service';
import { SupplierAccountListItem } from '../../core/models/supplier-account.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-purchases-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchases-list.component.html',
  styleUrls: ['./purchases-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchasesListComponent implements OnInit {
  accounts: SupplierAccountListItem[] = [];
  loading = true;
  search = '';

  constructor(
    private readonly supplierAccountService: SupplierAccountService,
    private readonly toast: ToastService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.supplierAccountService.listAccounts(this.search.trim() || undefined).subscribe({
      next: accounts => {
        this.accounts = accounts;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar los proveedores');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applySearch(): void {
    this.load();
  }

  clearSearch(): void {
    this.search = '';
    this.load();
  }

  get conDeuda(): number {
    return this.accounts.filter(a => a.saldoPendiente > 0).length;
  }

  openAccount(supplierId: string): void {
    this.router.navigate(['/purchases/supplier', supplierId]);
  }

  goToCreate(): void {
    this.router.navigate(['/purchases/new']);
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
