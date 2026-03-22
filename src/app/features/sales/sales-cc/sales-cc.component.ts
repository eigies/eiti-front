import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { StockService } from '../../../core/services/stock.service';
import { SaleService } from '../../../core/services/sale.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { CustomerSearchItem } from '../../../core/models/customer.models';
import { BranchProductStockResponse } from '../../../core/models/stock.models';
import { CreateSaleDetailRequest } from '../../../core/models/sale.models';

interface DraftItem {
  stock: BranchProductStockResponse;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-sales-cc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './sales-cc.component.html',
  styleUrls: ['./sales-cc.component.css']
})
export class SalesCcComponent implements OnInit {
  branches: BranchResponse[] = [];
  selectedBranchId = '';

  customerQuery = '';
  searchResults: CustomerSearchItem[] = [];
  selectedCustomer: CustomerSearchItem | null = null;

  draftItems: DraftItem[] = [];
  saving = false;

  productModalOpen = false;
  productQuery = '';
  stockItems: BranchProductStockResponse[] = [];
  stockByProductId = new Map<string, BranchProductStockResponse>();
  selectedProductIds = new Set<string>();
  selectionQuantityByProductId = new Map<string, number>();

  constructor(
    private readonly branchService: BranchService,
    private readonly customerService: CustomerService,
    private readonly stockService: StockService,
    private readonly saleService: SaleService,
    private readonly toast: ToastService,
    private readonly router: Router,
    public readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.branchService.listBranches().subscribe({
      next: branches => {
        this.branches = branches;
        if (branches.length > 0) {
          this.selectedBranchId = branches[0].id;
        }
      },
      error: () => this.toast.error('No se pudieron cargar las sucursales')
    });
  }

  get total(): number {
    return this.draftItems.reduce((sum, item) => sum + item.total, 0);
  }

  get selectedProductsCount(): number {
    return this.selectedProductIds.size;
  }

  get productSuggestions(): BranchProductStockResponse[] {
    return this.filterStock(this.productQuery);
  }

  get canSubmit(): boolean {
    return !this.saving && this.selectedCustomer !== null && this.draftItems.length > 0 && !!this.selectedBranchId;
  }

  get selectedBranchName(): string {
    return this.branches.find(b => b.id === this.selectedBranchId)?.name ?? '';
  }

  onBranchChange(): void {
    this.draftItems = [];
    this.stockItems = [];
    this.stockByProductId.clear();
    this.selectedProductIds.clear();
    this.selectionQuantityByProductId.clear();
  }

  searchCustomers(): void {
    const query = this.customerQuery.trim();
    if (!query) {
      this.toast.error('Ingresa un termino de busqueda');
      return;
    }
    this.customerService.searchCustomers(query).subscribe({
      next: results => {
        this.searchResults = results;
        if (results.length === 0) {
          this.toast.error('No se encontraron clientes');
        }
      },
      error: () => this.toast.error('No se pudo buscar clientes')
    });
  }

  selectCustomer(customer: CustomerSearchItem): void {
    this.selectedCustomer = customer;
    this.searchResults = [];
    this.customerQuery = '';
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
  }

  openProductModal(): void {
    if (!this.selectedBranchId) {
      this.toast.error('Selecciona una sucursal primero');
      return;
    }
    this.productQuery = '';
    this.selectedProductIds.clear();
    this.selectionQuantityByProductId.clear();

    if (this.stockItems.length === 0) {
      this.loadStock();
    } else {
      this.productModalOpen = true;
    }
  }

  private loadStock(): void {
    this.stockService.listBranchStock(this.selectedBranchId).subscribe({
      next: items => {
        this.stockItems = items;
        this.stockByProductId.clear();
        for (const item of items) {
          this.stockByProductId.set(item.productId, item);
        }
        this.productModalOpen = true;
      },
      error: () => this.toast.error('No se pudo cargar el stock de la sucursal')
    });
  }

  closeProductModal(): void {
    this.productModalOpen = false;
  }

  handleProductInput(query: string): void {
    this.productQuery = query;
  }

  availableForProduct(productId: string): number {
    const base = this.stockByProductId.get(productId)?.availableQuantity ?? 0;
    const inDraft = this.draftItems.find(item => item.stock.productId === productId)?.quantity ?? 0;
    return Math.max(base - inDraft, 0);
  }

  isProductSelected(productId: string): boolean {
    return this.selectedProductIds.has(productId);
  }

  selectionQuantity(productId: string): number {
    return this.selectionQuantityByProductId.get(productId) ?? 1;
  }

  setSelectionQuantity(productId: string, rawValue: string): void {
    const parsed = Number(rawValue);
    const max = Math.max(1, this.availableForProduct(productId));
    this.selectionQuantityByProductId.set(
      productId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : 1
    );
  }

  toggleProductSelection(stock: BranchProductStockResponse, checked: boolean): void {
    if (checked && this.availableForProduct(stock.productId) <= 0) {
      this.toast.error(`Sin stock disponible para ${stock.brand} / ${stock.name}.`);
      return;
    }
    if (checked) {
      this.selectedProductIds.add(stock.productId);
      if (!this.selectionQuantityByProductId.has(stock.productId)) {
        this.selectionQuantityByProductId.set(stock.productId, 1);
      }
      return;
    }
    this.selectedProductIds.delete(stock.productId);
    this.selectionQuantityByProductId.delete(stock.productId);
  }

  addSelectedItems(): void {
    if (this.selectedProductIds.size === 0) { return; }
    let added = 0;
    for (const productId of [...this.selectedProductIds]) {
      const stock = this.stockByProductId.get(productId);
      if (!stock) { continue; }
      const quantity = this.selectionQuantity(productId);
      const maxAllowed = stock.availableQuantity;
      if (this.upsertDraftItem(stock, quantity, maxAllowed)) { added += 1; }
    }
    if (added > 0) {
      this.selectedProductIds.clear();
      this.selectionQuantityByProductId.clear();
      this.productModalOpen = false;
    }
  }

  removeItem(productId: string): void {
    this.draftItems = this.draftItems.filter(item => item.stock.productId !== productId);
  }

  submit(): void {
    if (!this.canSubmit) { return; }
    if (!this.selectedCustomer) {
      this.toast.error('Selecciona un cliente para continuar');
      return;
    }
    if (this.draftItems.length === 0) {
      this.toast.error('Agrega al menos un producto para continuar');
      return;
    }
    if (!this.selectedBranchId) {
      this.toast.error('Selecciona una sucursal');
      return;
    }

    this.saving = true;
    const details: CreateSaleDetailRequest[] = this.draftItems.map(item => ({
      productId: item.stock.productId,
      quantity: item.quantity
    }));

    this.saleService.createCcSale({
      branchId: this.selectedBranchId,
      customerId: this.selectedCustomer.id,
      details
    }).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Venta CC creada exitosamente');
        this.router.navigate(['/sales']);
      },
      error: err => {
        this.saving = false;
        this.toast.error(
          (err as any)?.error?.detail ||
          (err as any)?.error?.message ||
          'Error al crear la venta CC'
        );
      }
    });
  }

  private upsertDraftItem(
    stock: BranchProductStockResponse,
    quantity: number,
    maxAllowed: number
  ): boolean {
    if (!Number.isFinite(quantity) || quantity <= 0) { return false; }
    const existing = this.draftItems.find(item => item.stock.productId === stock.productId);
    const nextQuantity = (existing?.quantity ?? 0) + Math.floor(quantity);
    if (nextQuantity > maxAllowed) {
      this.toast.error(
        `No hay stock suficiente para ${stock.brand} / ${stock.name}. Disponible: ${Math.max(maxAllowed, 0)}.`
      );
      return false;
    }
    const unitPrice = stock.publicPrice ?? stock.price ?? 0;
    if (existing) {
      existing.quantity = nextQuantity;
      existing.total = existing.quantity * unitPrice;
    } else {
      this.draftItems.unshift({
        stock,
        quantity: Math.floor(quantity),
        total: unitPrice * Math.floor(quantity)
      });
    }
    return true;
  }

  private filterStock(query: string): BranchProductStockResponse[] {
    const normalized = query.trim().toLowerCase();
    return this.stockItems
      .filter(item =>
        item.availableQuantity > 0 || this.isProductSelected(item.productId)
      )
      .filter(item =>
        !normalized ||
        `${item.code} ${item.sku} ${item.brand} ${item.name}`.toLowerCase().includes(normalized)
      )
      .slice(0, 30);
  }
}
