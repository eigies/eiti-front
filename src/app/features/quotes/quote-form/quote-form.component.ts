// src/app/features/quotes/quote-form/quote-form.component.ts
import { Component, OnInit, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { StockService } from '../../../core/services/stock.service';
import { QuoteService } from '../../../core/services/quote.service';
import { ToastService } from '../../../shared/services/toast.service';
import { extractApiError } from '../../../shared/utils/api-error.util';
import { BranchResponse } from '../../../core/models/branch.models';
import { CustomerSearchItem } from '../../../core/models/customer.models';
import { BranchProductStockResponse } from '../../../core/models/stock.models';
import { CreateQuoteRequest } from '../../../core/models/quote.models';
import { ProductPickerModalComponent } from '../../../shared/components/product-picker-modal/product-picker-modal.component';
import { ProductPickerRow, ProductPickerSelection, toProductPickerRow } from '../../../shared/components/product-picker-modal/product-picker-modal.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';

// Los presupuestos no reservan stock: el picker se abre con un "available" grande
// (no tiene sentido de negocio limitar la cantidad cotizada al stock actual).
const UNLIMITED_AVAILABLE = 999999;

interface QuoteDraftItem {
    stock: BranchProductStockResponse;
    quantity: number;
    discountPercent: number;
    unitPrice: number;
    total: number;
}

@Component({
    selector: 'app-quote-form',
    standalone: true,
    imports: [CommonModule, FormsModule, ProductPickerModalComponent, SearchableSelectComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './quote-form.component.html',
    styleUrls: ['./quote-form.component.css']
})
export class QuoteFormComponent implements OnInit {
    branches: BranchResponse[] = [];
    selectedBranchId = '';

    customerMode: 'existing' | 'prospect' = 'existing';
    customerQuery = '';
    searchResults: CustomerSearchItem[] = [];
    selectedCustomer: CustomerSearchItem | null = null;
    prospectName = '';
    prospectContact = '';

    generalDiscountPercent = 0;
    expiresAt = this.defaultExpiresAt();

    // Los precios se cargan NETOS (sin IVA); el sistema suma el IVA sobre el neto.
    // includesVat = el presupuesto cobra IVA (neto + IVA) o no (solo neto). vatRate: 21 | 10.5 | 0 (exento).
    readonly vatRateOptions: readonly number[] = [21, 10.5, 0];
    vatRate = 21;
    includesVat = true;

    draftItems: QuoteDraftItem[] = [];
    stockItems: BranchProductStockResponse[] = [];
    stockByProductId = new Map<string, BranchProductStockResponse>();
    productModalOpen = false;
    pickerRows: ProductPickerRow[] = [];

    saving = false;

    @Output() created = new EventEmitter<void>();

    constructor(
        private readonly branchService: BranchService,
        private readonly customerService: CustomerService,
        private readonly stockService: StockService,
        private readonly quoteService: QuoteService,
        private readonly toast: ToastService,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.branchService.listBranches().subscribe({
            next: branches => {
                this.branches = branches;
                if (branches.length > 0) { this.selectedBranchId = branches[0].id; }
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('No se pudieron cargar las sucursales');
                this.cdr.markForCheck();
            }
        });
    }

    private defaultExpiresAt(): string {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().slice(0, 10);
    }

    // Subtotal NETO (los precios cargados son netos), ya con el descuento general aplicado.
    get total(): number {
        const subtotal = this.draftItems.reduce((sum, item) => sum + item.total, 0);
        if (this.generalDiscountPercent > 0) {
            return Math.round(subtotal * (1 - this.generalDiscountPercent / 100) * 100) / 100;
        }
        return subtotal;
    }

    // IVA que suma el sistema sobre el neto (0 si el presupuesto va sin IVA o es exento).
    get vatAmount(): number {
        if (!this.includesVat || this.vatRate <= 0) { return 0; }
        return Math.round(this.total * this.vatRate / 100 * 100) / 100;
    }

    // Total que paga el cliente = neto + IVA.
    get grandTotal(): number {
        return Math.round((this.total + this.vatAmount) * 100) / 100;
    }

    get canSubmit(): boolean {
        const hasClient = this.customerMode === 'existing' ? !!this.selectedCustomer : this.prospectName.trim().length > 0;
        return !this.saving && hasClient && this.draftItems.length > 0 && !!this.selectedBranchId && !!this.expiresAt;
    }

    get branchOptions(): SearchableSelectOption[] {
        return this.branches.map(branch => ({ value: branch.id, label: branch.name }));
    }

    get isProspectMode(): boolean {
        return this.customerMode === 'prospect';
    }

    set isProspectMode(value: boolean) {
        this.customerMode = value ? 'prospect' : 'existing';
        this.onCustomerModeChange();
    }

    onBranchChange(): void {
        this.draftItems = [];
        this.stockItems = [];
        this.stockByProductId.clear();
        this.pickerRows = [];
    }

    onCustomerModeChange(): void {
        this.selectedCustomer = null;
        this.prospectName = '';
        this.prospectContact = '';
        this.customerQuery = '';
        this.searchResults = [];
    }

    searchCustomers(): void {
        const query = this.customerQuery.trim();
        if (!query) { this.toast.error('Ingresa un termino de busqueda'); return; }
        this.customerService.searchCustomers(query).subscribe({
            next: results => {
                this.searchResults = results;
                if (results.length === 0) { this.toast.error('No se encontraron clientes'); }
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('No se pudo buscar clientes');
                this.cdr.markForCheck();
            }
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
        if (!this.selectedBranchId) { this.toast.error('Selecciona una sucursal primero'); return; }
        if (this.stockItems.length === 0) {
            this.stockService.listBranchStock(this.selectedBranchId).subscribe({
                next: items => {
                    this.stockItems = items;
                    this.stockByProductId.clear();
                    for (const item of items) { this.stockByProductId.set(item.productId, item); }
                    this.buildPickerRows();
                    this.productModalOpen = true;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.toast.error('No se pudo cargar el stock de la sucursal');
                    this.cdr.markForCheck();
                }
            });
        } else {
            this.buildPickerRows();
            this.productModalOpen = true;
        }
    }

    private buildPickerRows(): void {
        this.pickerRows = this.stockItems.map(stock =>
            toProductPickerRow(
                { id: stock.productId, code: stock.code, sku: stock.sku, brand: stock.brand, name: stock.name },
                UNLIMITED_AVAILABLE
            )
        );
    }

    closeProductModal(): void {
        this.productModalOpen = false;
        this.pickerRows = [];
    }

    onPickerConfirm(selection: ProductPickerSelection[]): void {
        for (const { id, quantity } of selection) {
            const stock = this.stockByProductId.get(id);
            if (!stock || quantity <= 0) { continue; }
            const existing = this.draftItems.find(item => item.stock.productId === id);
            if (existing) {
                existing.quantity += Math.floor(quantity);
                this.recalcItem(existing);
            } else {
                const item: QuoteDraftItem = {
                    stock,
                    quantity: Math.floor(quantity),
                    discountPercent: 0,
                    unitPrice: stock.publicPrice ?? stock.price ?? 0,
                    total: 0
                };
                this.recalcItem(item);
                this.draftItems.unshift(item);
            }
        }
        this.closeProductModal();
    }

    private recalcItem(item: QuoteDraftItem): void {
        item.total = Math.round(item.quantity * item.unitPrice * (1 - item.discountPercent / 100) * 100) / 100;
    }

    setItemPrice(productId: string, value: number | null): void {
        const item = this.draftItems.find(i => i.stock.productId === productId);
        if (!item) { return; }
        item.unitPrice = value != null && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : item.unitPrice;
        this.recalcItem(item);
    }

    setItemDiscount(productId: string, rawValue: string): void {
        const item = this.draftItems.find(i => i.stock.productId === productId);
        if (!item) { return; }
        const parsed = Number(rawValue);
        item.discountPercent = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
        this.recalcItem(item);
    }

    readonly vatRateSelectOptions: SearchableSelectOption[] = [
        { value: 21, label: 'IVA 21%' },
        { value: 10.5, label: 'IVA 10,5%' },
        { value: 0, label: 'Exento' }
    ];

    setVatRate(value: string | number | null): void {
        const parsed = Number(value);
        this.vatRate = this.vatRateOptions.includes(parsed) ? parsed : 21;
    }

    setIncludesVat(checked: boolean): void {
        this.includesVat = checked;
    }

    setGeneralDiscount(rawValue: string): void {
        const parsed = Number(rawValue);
        this.generalDiscountPercent = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
    }

    removeItem(productId: string): void {
        this.draftItems = this.draftItems.filter(item => item.stock.productId !== productId);
    }

    submit(): void {
        if (!this.canSubmit) { return; }
        this.saving = true;

        const request: CreateQuoteRequest = {
            branchId: this.selectedBranchId,
            customerId: this.customerMode === 'existing' ? this.selectedCustomer!.id : null,
            prospectName: this.customerMode === 'prospect' ? this.prospectName.trim() : null,
            prospectContact: this.customerMode === 'prospect' ? this.prospectContact.trim() || null : null,
            details: this.draftItems.map(item => ({
                productId: item.stock.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent || undefined
            })),
            generalDiscountPercent: this.generalDiscountPercent || 0,
            expiresAt: new Date(this.expiresAt).toISOString(),
            vatRate: this.vatRate,
            includesVat: this.includesVat
        };

        this.quoteService.createQuote(request).subscribe({
            next: () => {
                this.saving = false;
                this.toast.success('Presupuesto creado');
                this.resetForm();
                this.created.emit();
                this.cdr.markForCheck();
            },
            error: err => {
                this.saving = false;
                this.toast.error(extractApiError(err, 'No se pudo crear el presupuesto'));
                this.cdr.markForCheck();
            }
        });
    }

    private resetForm(): void {
        this.customerMode = 'existing';
        this.selectedCustomer = null;
        this.customerQuery = '';
        this.searchResults = [];
        this.prospectName = '';
        this.prospectContact = '';
        this.draftItems = [];
        this.generalDiscountPercent = 0;
        this.expiresAt = this.defaultExpiresAt();
        this.vatRate = 21;
        this.includesVat = true;
    }
}
