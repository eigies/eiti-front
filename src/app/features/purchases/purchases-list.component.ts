import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierService } from '../../core/services/supplier.service';
import { PurchaseListItem, PurchaseStatus } from '../../core/models/purchase.models';
import { SupplierListItem } from '../../core/models/supplier.models';
import { ToastService } from '../../shared/services/toast.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-purchases-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './purchases-list.component.html',
  styleUrls: ['./purchases-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchasesListComponent implements OnInit {
  purchases: PurchaseListItem[] = [];
  suppliers: SupplierListItem[] = [];
  loading = true;
  total = 0;
  page = 1;
  readonly pageSize = 20;

  // Filters
  filterSupplierId = '';
  filterStatus = '';
  filterFrom = '';
  filterTo = '';

  readonly PurchaseStatus = PurchaseStatus;

  get supplierOptions(): SearchableSelectOption[] {
    return this.suppliers.map(supplier => ({
      value: supplier.id,
      label: supplier.name,
      meta: supplier.taxId || supplier.email || undefined,
      searchText: `${supplier.taxId ?? ''} ${supplier.email ?? ''}`
    }));
  }

  get statusOptions(): SearchableSelectOption[] {
    return [
      { value: 1, label: 'Pendiente' },
      { value: 2, label: 'Pagada' },
      { value: 3, label: 'Cancelada' }
    ];
  }

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly supplierService: SupplierService,
    private readonly toast: ToastService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.supplierService.listSuppliers(undefined, false).subscribe({
      next: s => { this.suppliers = s; this.cdr.markForCheck(); }
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.purchaseService.listPurchases({
      supplierId: this.filterSupplierId || undefined,
      status: this.filterStatus ? Number(this.filterStatus) : undefined,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.purchases = res.items;
        this.total = res.total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar las compras');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  clearFilters(): void {
    this.filterSupplierId = '';
    this.filterStatus = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.page = 1;
    this.load();
  }

  goToDetail(id: string): void {
    this.router.navigate(['/purchases', id]);
  }

  goToCreate(): void {
    this.router.navigate(['/purchases/new']);
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page * this.pageSize < this.total) { this.page++; this.load(); }
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  statusLabel(status: PurchaseStatus): string {
    switch (status) {
      case PurchaseStatus.Active: return 'Pendiente';
      case PurchaseStatus.Paid: return 'Pagada';
      case PurchaseStatus.Cancelled: return 'Cancelada';
      default: return 'Desconocido';
    }
  }

  statusChipClass(status: PurchaseStatus): string {
    switch (status) {
      case PurchaseStatus.Active: return 'chip--warning';
      case PurchaseStatus.Paid: return 'chip--success';
      case PurchaseStatus.Cancelled: return 'chip--muted';
      default: return 'chip--muted';
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
