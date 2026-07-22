import { Component, OnInit } from '@angular/core';
import { extractApiError } from '../../../shared/utils/api-error.util';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { StockService } from '../../../core/services/stock.service';
import { SaleService } from '../../../core/services/sale.service';
import { QuoteService } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionCodes } from '../../../core/models/permission.models';
import { ToastService } from '../../../shared/services/toast.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { CustomerSearchItem, toCustomerSearchItem } from '../../../core/models/customer.models';
import { BranchProductStockResponse } from '../../../core/models/stock.models';
import { CreateCcSaleRequest, CreateSaleDetailRequest } from '../../../core/models/sale.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ProductPickerModalComponent } from '../../../shared/components/product-picker-modal/product-picker-modal.component';
import { ProductPickerRow, ProductPickerSelection, toProductPickerRow } from '../../../shared/components/product-picker-modal/product-picker-modal.models';
import { QuickCustomerModalComponent } from '../../../shared/components/quick-customer-modal/quick-customer-modal.component';

interface DraftItem {
  stock: BranchProductStockResponse;
  quantity: number;
  discountPercent: number;
  unitPriceOverride?: number;
  forceUnitPrice?: boolean;
  total: number;
}

interface TradeInDraft {
  productId: string;
  brand: string;
  name: string;
  quantity: number;
  amount: number;
}

interface QuotePrefillDetail {
  productId: string;
  productName: string;
  productBrand: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

interface QuotePrefill {
  quoteId: string;
  branchId: string;
  customerId?: string | null;
  customerFullName?: string | null;
  prospectName?: string | null;
  generalDiscountPercent: number;
  vatRate: number;
  includesVat: boolean;
  details: QuotePrefillDetail[];
}

@Component({
  selector: 'app-sales-cc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, SearchableSelectComponent, ProductPickerModalComponent, QuickCustomerModalComponent],
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

  generalDiscountPercent = 0;
  manualOverridePrice: number | null = null;
  convertingQuoteId: string | null = null;
  quoteConversionLabel = '';
  quoteStockDisclaimer: string[] = [];
  // IVA de la conversión: arranca con lo que eligió el presupuesto y el usuario puede cambiarlo.
  // Los precios del presupuesto son netos; "con IVA" hace que la venta baje al final (neto + IVA).
  convertVatRate = 0;
  convertWithVat = false;
  private pendingQuotePrefill: QuotePrefill | null = null;

  showQuickCustomerModal = false;
  quickCustomerInitialFirstName = '';
  quickCustomerInitialLastName = '';
  quickCustomerInitialPhone = '';

  productModalOpen = false;
  pickerRows: ProductPickerRow[] = [];
  stockItems: BranchProductStockResponse[] = [];
  stockByProductId = new Map<string, BranchProductStockResponse>();

  // Canje (igual que en la venta normal): suma al stock y descuenta de la deuda.
  tradeInDrafts: TradeInDraft[] = [];
  canjeProductId: string | null = null;
  canjeQuantity = 1;
  canjeAmount: number | null = null;

  constructor(
    private readonly branchService: BranchService,
    private readonly customerService: CustomerService,
    private readonly stockService: StockService,
    private readonly saleService: SaleService,
    private readonly quoteService: QuoteService,
    private readonly toast: ToastService,
    public readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    const state = history.state as { quotePrefill?: QuotePrefill } | null;
    this.pendingQuotePrefill = state?.quotePrefill ?? null;

    this.branchService.listBranches().subscribe({
      next: branches => {
        this.branches = branches;
        if (this.pendingQuotePrefill) {
          this.selectedBranchId = this.pendingQuotePrefill.branchId;
          this.convertingQuoteId = this.pendingQuotePrefill.quoteId;
          this.quoteConversionLabel =
            this.pendingQuotePrefill.customerFullName
            ?? this.pendingQuotePrefill.prospectName
            ?? 'presupuesto seleccionado';
          this.generalDiscountPercent = this.pendingQuotePrefill.generalDiscountPercent || 0;
          this.convertVatRate = this.pendingQuotePrefill.vatRate || 0;
          this.convertWithVat = this.pendingQuotePrefill.includesVat && this.convertVatRate > 0;
          this.applyQuotePrefill();
        } else if (branches.length > 0) {
          this.selectedBranchId = branches[0].id;
        }
      },
      error: () => this.toast.error('No se pudieron cargar las sucursales')
    });
  }

  get subtotalAfterItemDiscounts(): number {
    return this.draftItems.reduce((sum, item) => sum + item.total, 0);
  }

  get totalAfterGeneralDiscount(): number {
    const sub = this.subtotalAfterItemDiscounts;
    if (this.generalDiscountPercent > 0) {
      return Math.round(sub * (1 - this.generalDiscountPercent / 100) * 100) / 100;
    }
    return sub;
  }

  get total(): number {
    if (this.manualOverridePrice !== null && this.manualOverridePrice >= 0) {
      return this.manualOverridePrice;
    }
    return this.totalAfterGeneralDiscount;
  }

  get isManualOverride(): boolean {
    return this.manualOverridePrice !== null && this.manualOverridePrice >= 0;
  }

  get canSubmit(): boolean {
    return !this.saving && this.selectedCustomer !== null && this.draftItems.length > 0 && !!this.selectedBranchId;
  }

  get selectedBranchName(): string {
    return this.branches.find(b => b.id === this.selectedBranchId)?.name ?? '';
  }

  get branchOptions(): SearchableSelectOption[] {
    return this.branches.map(branch => ({
      value: branch.id,
      label: branch.name
    }));
  }

  onBranchChange(): void {
    this.draftItems = [];
    this.stockItems = [];
    this.stockByProductId.clear();
    this.pickerRows = [];
    this.tradeInDrafts = [];
    this.canjeProductId = null;
    this.canjeQuantity = 1;
    this.canjeAmount = null;
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

    if (this.stockItems.length === 0) {
      this.loadStock();
    } else {
      this.buildPickerRows();
      this.productModalOpen = true;
    }
  }

  private loadStock(openModal = true): void {
    this.stockService.listBranchStock(this.selectedBranchId).subscribe({
      next: items => {
        this.setStockItems(items);
        if (openModal) {
          this.buildPickerRows();
          this.productModalOpen = true;
        }
      },
      error: () => this.toast.error('No se pudo cargar el stock de la sucursal')
    });
  }

  private setStockItems(items: BranchProductStockResponse[]): void {
    this.stockItems = items;
    this.stockByProductId.clear();
    for (const item of items) {
      this.stockByProductId.set(item.productId, item);
    }
  }

  private applyQuotePrefill(): void {
    if (!this.pendingQuotePrefill || !this.selectedBranchId) { return; }

    this.stockService.listBranchStock(this.selectedBranchId).subscribe({
      next: items => {
        this.setStockItems(items);
        this.draftItems = [];
        this.quoteStockDisclaimer = [];

        for (const detail of this.pendingQuotePrefill!.details) {
          const stock = this.stockByProductId.get(detail.productId);
          const productLabel = `${detail.productBrand} ${detail.productName}`.trim();
          const available = stock?.availableQuantity ?? 0;

          if (!stock || available <= 0) {
            this.quoteStockDisclaimer.push(`${productLabel}: sin stock disponible, no se cargo a la venta.`);
            continue;
          }

          const quantityToLoad = Math.min(detail.quantity, available);
          if (quantityToLoad < detail.quantity) {
            this.quoteStockDisclaimer.push(
              `${productLabel}: se pidieron ${detail.quantity}, solo hay ${available} disponible${available === 1 ? '' : 's'}. Se cargaron ${quantityToLoad}.`
            );
          }

          this.draftItems.push({
            stock,
            quantity: quantityToLoad,
            discountPercent: detail.discountPercent || 0,
            unitPriceOverride: Math.round(detail.unitPrice * 100) / 100,
            forceUnitPrice: true,
            total: 0
          });
          this.recalcItem(this.draftItems[this.draftItems.length - 1]);
        }

        this.buildPickerRows();
        this.resolveQuoteCustomer();
        if (this.quoteStockDisclaimer.length > 0) {
          this.toast.error('Presupuesto precargado con ajustes de stock. Revisa el detalle en pantalla.');
        } else {
          this.toast.success('Presupuesto precargado para convertir a venta CC');
        }
      },
      error: () => this.toast.error('No se pudo cargar el stock para convertir el presupuesto')
    });
  }

  private resolveQuoteCustomer(): void {
    if (!this.pendingQuotePrefill) { return; }

    if (this.pendingQuotePrefill.customerId) {
      this.customerService.getCustomerById(this.pendingQuotePrefill.customerId).subscribe({
        next: customer => this.selectedCustomer = toCustomerSearchItem(customer),
        error: () => this.toast.error('No se pudo cargar el cliente del presupuesto')
      });
      return;
    }

    // Presupuesto de un prospecto sin cuenta: en vez de forzar al vendedor a ir primero a
    // Clientes y volver, se le ofrece crearlo ahi mismo (nombre/telefono precargados) y
    // queda seleccionado automaticamente para poder convertir sin cortar el flujo.
    this.selectedCustomer = null;
    this.customerQuery = this.pendingQuotePrefill.prospectName ?? '';
    const [firstName, ...rest] = (this.pendingQuotePrefill.prospectName ?? '').trim().split(/\s+/);
    this.quickCustomerInitialFirstName = firstName ?? '';
    this.quickCustomerInitialLastName = rest.join(' ');
    this.quickCustomerInitialPhone = '';
    this.showQuickCustomerModal = true;
  }

  onQuickCustomerCreated(customer: CustomerSearchItem): void {
    this.selectedCustomer = customer;
    this.searchResults = [];
    this.customerQuery = '';
    this.showQuickCustomerModal = false;
  }

  onQuickCustomerCancelled(): void {
    this.showQuickCustomerModal = false;
  }

  private buildPickerRows(): void {
    this.pickerRows = this.stockItems.map(stock =>
      toProductPickerRow(
        { id: stock.productId, code: stock.code, sku: stock.sku, brand: stock.brand, name: stock.name },
        this.availableForProduct(stock.productId)
      )
    );
  }

  closeProductModal(): void {
    this.productModalOpen = false;
    this.pickerRows = [];
  }

  availableForProduct(productId: string): number {
    const base = this.stockByProductId.get(productId)?.availableQuantity ?? 0;
    const inDraft = this.draftItems.find(item => item.stock.productId === productId)?.quantity ?? 0;
    return Math.max(base - inDraft, 0);
  }

  onPickerConfirm(selection: ProductPickerSelection[]): void {
    let added = 0;
    for (const { id, quantity } of selection) {
      const stock = this.stockByProductId.get(id);
      if (!stock) { continue; }
      if (this.upsertDraftItem(stock, quantity, stock.availableQuantity)) { added += 1; }
    }
    if (added > 0) {
      this.closeProductModal();
    }
  }

  removeItem(productId: string): void {
    this.draftItems = this.draftItems.filter(item => item.stock.productId !== productId);
  }

  get canOverridePrice(): boolean {
    return this.auth.hasPermission(PermissionCodes.salesPriceOverride);
  }

  effectiveUnitPrice(item: DraftItem): number {
    return item.unitPriceOverride ?? item.stock.publicPrice ?? item.stock.price ?? 0;
  }

  // El item arranca con el precio público; se considera "override" sólo si difiere de él.
  isPriceOverridden(item: DraftItem): boolean {
    const base = item.stock.publicPrice ?? item.stock.price ?? 0;
    return item.unitPriceOverride != null && item.unitPriceOverride !== base;
  }

  private recalcItem(item: DraftItem): void {
    const unitPrice = this.effectiveUnitPrice(item);
    item.total = Math.round(item.quantity * unitPrice * (1 - item.discountPercent / 100) * 100) / 100;
  }

  setItemPrice(productId: string, value: number | null): void {
    const item = this.draftItems.find(i => i.stock.productId === productId);
    if (!item || !this.canOverridePrice) return;
    item.unitPriceOverride = value != null && Number.isFinite(value) && value >= 0
      ? Math.round(value * 100) / 100
      : undefined;
    this.recalcItem(item);
  }

  setItemDiscount(productId: string, rawValue: string): void {
    const item = this.draftItems.find(i => i.stock.productId === productId);
    if (!item) return;
    const parsed = Number(rawValue);
    item.discountPercent = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
    this.recalcItem(item);
  }

  setGeneralDiscount(rawValue: string): void {
    const parsed = Number(rawValue);
    this.generalDiscountPercent = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
  }

  setManualOverride(value: number | null): void {
    this.manualOverridePrice = value != null && Number.isFinite(value) && value >= 0
      ? Math.round(value * 100) / 100
      : null;
  }

  clearManualOverride(): void {
    this.manualOverridePrice = null;
  }

  // --- Canje ---
  get tradeInProductOptions(): SearchableSelectOption[] {
    return this.stockItems.map(s => ({ value: s.productId, label: `${s.code} · ${s.brand} ${s.name}`.trim() }));
  }

  get canjeTotal(): number {
    return Math.round(this.tradeInDrafts.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  }

  // Deuda que asume el cliente = total de la venta menos el valor del canje entregado.
  get netAfterTradeIn(): number {
    return Math.max(0, Math.round((this.total - this.canjeTotal) * 100) / 100);
  }

  // El catálogo del canje reutiliza el stock de la sucursal; lo cargamos si aún no está.
  ensureStockForCanje(): void {
    if (this.stockItems.length === 0 && this.selectedBranchId) {
      this.loadStock(false);
    }
  }

  addTradeIn(): void {
    if (!this.canjeProductId) { this.toast.error('Elegí el producto del canje.'); return; }
    const stock = this.stockByProductId.get(this.canjeProductId);
    if (!stock) { this.toast.error('Producto de canje inválido.'); return; }
    const quantity = Math.floor(Number(this.canjeQuantity));
    if (!Number.isFinite(quantity) || quantity <= 0) { this.toast.error('La cantidad del canje debe ser mayor a cero.'); return; }
    const amount = Number(this.canjeAmount);
    if (!Number.isFinite(amount) || amount < 0) { this.toast.error('Ingresá el valor del canje.'); return; }
    if (this.tradeInDrafts.some(t => t.productId === stock.productId)) { this.toast.error('Ese producto ya está en el canje.'); return; }

    this.tradeInDrafts = [...this.tradeInDrafts, {
      productId: stock.productId,
      brand: stock.brand,
      name: stock.name,
      quantity,
      amount: Math.round(amount * 100) / 100
    }];
    this.canjeProductId = null;
    this.canjeQuantity = 1;
    this.canjeAmount = null;
  }

  removeTradeIn(index: number): void {
    this.tradeInDrafts = this.tradeInDrafts.filter((_, i) => i !== index);
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
      quantity: item.quantity,
      unitPrice: item.forceUnitPrice || (this.canOverridePrice && this.isPriceOverridden(item))
        ? item.unitPriceOverride
        : undefined,
      discountPercent: item.discountPercent || undefined
    }));

    const payload: CreateCcSaleRequest = {
      branchId: this.selectedBranchId,
      customerId: this.selectedCustomer.id,
      details,
      tradeIns: this.tradeInDrafts.length
        ? this.tradeInDrafts.map(t => ({ productId: t.productId, quantity: t.quantity, amount: t.amount }))
        : undefined,
      generalDiscountPercent: this.generalDiscountPercent || undefined,
      manualOverridePrice: this.manualOverridePrice ?? undefined
    };

    const request$ = this.convertingQuoteId
      ? this.quoteService.convertQuote(this.convertingQuoteId, { ...payload, withVat: this.convertWithVat })
      : this.saleService.createCcSale(payload);

    request$.subscribe({
      next: (res) => {
        this.saving = false;
        this.toast.success(this.convertingQuoteId
          ? 'Presupuesto convertido a venta CC exitosamente'
          : 'Venta CC creada exitosamente');
        if (res?.creditApplied && res.creditApplied > 0) {
          const applied = res.creditApplied.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const remaining = res.remainingCustomerCredit?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) ?? '0,00';
          this.toast.success(`Se aplicaron $${applied} de saldo a favor. Crédito restante: $${remaining}`);
        }
        this.selectedCustomer = null;
        this.customerQuery = '';
        this.searchResults = [];
        this.draftItems = [];
        this.tradeInDrafts = [];
        this.canjeProductId = null;
        this.canjeQuantity = 1;
        this.canjeAmount = null;
        this.generalDiscountPercent = 0;
        this.manualOverridePrice = null;
        this.convertingQuoteId = null;
        this.pendingQuotePrefill = null;
        this.quoteConversionLabel = '';
        this.quoteStockDisclaimer = [];
        this.convertWithVat = false;
        this.convertVatRate = 0;
        this.pickerRows = [];
      },
      error: err => {
        this.saving = false;
        this.toast.error(extractApiError(err, this.convertingQuoteId
          ? 'Error al convertir el presupuesto'
          : 'Error al crear la venta CC'));
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
    if (existing) {
      existing.quantity = nextQuantity;
      this.recalcItem(existing);
    } else {
      const item: DraftItem = {
        stock,
        quantity: Math.floor(quantity),
        discountPercent: 0,
        unitPriceOverride: stock.publicPrice ?? stock.price ?? 0,
        total: 0
      };
      this.recalcItem(item);
      this.draftItems.unshift(item);
    }
    return true;
  }
}
