import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { ProductService } from '../../core/services/product.service';
import { SaleService } from '../../core/services/sale.service';
import { CompanyService } from '../../core/services/company.service';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerSearchItem } from '../../core/models/customer.models';
import { ProductResponse, productPublicPrice } from '../../core/models/product.models';
import { SaleDetailResponse, SaleResponse } from '../../core/models/sale.models';
import { ToastService } from '../../shared/services/toast.service';
import { BranchService } from '../../core/services/branch.service';
import { BranchResponse } from '../../core/models/branch.models';
import { CashService } from '../../core/services/cash.service';
import { CashDrawerResponse } from '../../core/models/cash.models';
import { StockService } from '../../core/services/stock.service';
import { BranchProductStockResponse } from '../../core/models/stock.models';
import { EmployeeService } from '../../core/services/employee.service';
import { DriverResponse } from '../../core/models/employee.models';
import { VehicleService } from '../../core/services/vehicle.service';
import { VehicleResponse } from '../../core/models/vehicle.models';
import { SaleTransportResponse } from '../../core/models/transport.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SalePaymentInlineComponent } from '../../shared/components/sale-payment-inline/sale-payment-inline.component';
import {
    SalePaymentDraftState,
    createEmptySalePaymentDraftState,
    hasCashPayment,
    mapSalePaymentDraftState,
    normalizeSalePayments,
    normalizeSaleTradeIns,
    paymentMethodSummary,
    SALE_PAYMENT_METHOD_CASH,
    roundMoney
} from '../../core/models/sale-payment.models';

@Component({
    selector: 'app-sales-page',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent, OnboardingBannerComponent, SalePaymentInlineComponent],
    templateUrl: './sales-page.component.html',
    styleUrls: ['./sales-page.component.css']
})
export class SalesPageComponent implements OnInit {
    readonly permissionCodes = PermissionCodes;
    @ViewChild('editProductPicker') editProductPicker?: ElementRef<HTMLElement>;
    @ViewChild('editSection') editSection?: ElementRef<HTMLElement>;

    lineForm: FormGroup;
    filterForm: FormGroup;
    editLineForm: FormGroup;
    editMetaForm: FormGroup;
    transportForm: FormGroup;
    products: ProductResponse[] = [];
    branches: BranchResponse[] = [];
    createDrawers: CashDrawerResponse[] = [];
    editDrawers: CashDrawerResponse[] = [];
    createStockByProductId = new Map<string, BranchProductStockResponse>();
    editStockByProductId = new Map<string, BranchProductStockResponse>();
    editOriginalQuantitiesByProductId = new Map<string, number>();
    drivers: DriverResponse[] = [];
    vehicles: VehicleResponse[] = [];
    draftItems: DraftItem[] = [];
    sales: SaleResponse[] = [];
    editItems: DraftItem[] = [];
    editingSale: SaleResponse | null = null;
    transportingSale: SaleResponse | null = null;
    currentTransport: SaleTransportResponse | null = null;
    loadingProducts = false;
    loadingSales = false;
    saving = false;
    savingEdit = false;
    deletingSaleId: string | null = null;
    cancelingSaleId: string | null = null;
    quickPayingSaleId: string | null = null;
    sendingSaleWhatsAppId: string | null = null;
    createProductQuery = '';
    editProductQuery = '';
    showEditProductResults = false;
    createProductModalOpen = false;
    createCustomerId: string | null = null;
    createCustomerQuery = '';
    createCustomerSuggestions: CustomerSearchItem[] = [];
    showCreateCustomerResults = false;
    private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;
    createSelectedProductIds = new Set<string>();
    createSelectionQuantityByProductId = new Map<string, number>();
    createPaymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
    editPaymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
    createExpanded = true;
    listExpanded = true;
    showOnboardingCompleteNotice = false;
    infoModal: { title: string; rows: Array<{ label: string; value: string }> } | null = null;
    cancelSaleModal: SaleResponse | null = null;
    expandedSaleId: string | null = null;
    whatsAppEnabled = false;
    whatsAppPhoneNumber: string | null = null;
    readonly salesPageSizeOptions = [10, 25, 50];
    readonly detailPageSize = 5;
    currentSalesPage = 1;
    salesPageSize = 10;
    private readonly detailPageBySaleId = new Map<string, number>();

    constructor(
        private fb: FormBuilder,
        private productService: ProductService,
        private saleService: SaleService,
        private companyService: CompanyService,
        private customerService: CustomerService,
        private branchService: BranchService,
        private cashService: CashService,
        private stockService: StockService,
        private employeeService: EmployeeService,
        private vehicleService: VehicleService,
        private toast: ToastService,
        private onboardingService: OnboardingService,
        public auth: AuthService
    ) {
        this.lineForm = this.fb.group({
            branchId: ['', Validators.required],
            idSaleStatus: [1, Validators.required],
            hasDelivery: [false],
            cashDrawerId: [''],
            productId: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]]
        });
        this.editLineForm = this.fb.group({
            productId: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]]
        });
        this.editMetaForm = this.fb.group({
            branchId: ['', Validators.required],
            idSaleStatus: [1, Validators.required],
            hasDelivery: [false],
            cashDrawerId: ['']
        });
        this.transportForm = this.fb.group({
            driverEmployeeId: ['', Validators.required],
            vehicleId: ['', Validators.required],
            notes: ['']
        });
        this.filterForm = this.fb.group({ dateFrom: [''], dateTo: [''], idSaleStatus: [''] });
    }

    ngOnInit(): void {
        this.showOnboardingCompleteNotice = this.onboardingService.consumeCompletionNotice();
        this.loadProducts();
        this.loadBranches();
        this.loadSales();
        this.loadDrivers();
        this.loadVehicles();
        this.loadWhatsAppConfig();
    }

    get selectedProduct(): ProductResponse | null {
        return this.findProduct(this.lineForm.get('productId')?.value);
    }

    get draftTotal(): number {
        return this.sum(this.draftItems);
    }

    get editTotal(): number {
        return this.sum(this.editItems);
    }

    get isCreatePaid(): boolean {
        return Number(this.lineForm.get('idSaleStatus')?.value ?? 1) === 2;
    }

    get isEditPaid(): boolean {
        return Number(this.editMetaForm.get('idSaleStatus')?.value ?? 1) === 2;
    }

    get requiresCreateCashDrawer(): boolean {
        return this.isCreatePaid && hasCashPayment(this.createPaymentState);
    }

    get requiresEditCashDrawer(): boolean {
        return this.isEditPaid && hasCashPayment(this.editPaymentState);
    }

    get activeVehicles(): VehicleResponse[] {
        return this.vehicles.filter(vehicle => vehicle.isActive);
    }

    get createProductSuggestions(): ProductResponse[] {
        return this.filterProducts(this.createProductQuery);
    }

    get createSelectedProductsCount(): number {
        return this.createSelectedProductIds.size;
    }

    get editProductSuggestions(): ProductResponse[] {
        return this.filterProducts(this.editProductQuery);
    }

    get totalSalesPages(): number {
        return Math.max(1, Math.ceil(this.sales.length / this.salesPageSize));
    }

    get pagedSales(): SaleResponse[] {
        const start = (this.currentSalesPage - 1) * this.salesPageSize;
        return this.sales.slice(start, start + this.salesPageSize);
    }

    get salesPageStart(): number {
        if (this.sales.length === 0) {
            return 0;
        }

        return ((this.currentSalesPage - 1) * this.salesPageSize) + 1;
    }

    get salesPageEnd(): number {
        if (this.sales.length === 0) {
            return 0;
        }

        return Math.min(this.currentSalesPage * this.salesPageSize, this.sales.length);
    }

    handleCreateBranchChange(): void {
        const branchId = this.lineForm.get('branchId')?.value ?? '';
        this.lineForm.patchValue({ cashDrawerId: '' });
        this.loadDrawers(branchId, true);
        this.loadStockForBranch(branchId, true);
    }

    handleEditStatusChange(): void {
        if (this.isEditPaid) {
            const branchId = this.editMetaForm.get('branchId')?.value ?? '';
            this.editMetaForm.patchValue({ cashDrawerId: '' });
            this.loadDrawers(branchId, false);
            return;
        }

        this.editMetaForm.patchValue({ cashDrawerId: '' });
    }

    setCreateCashDrawerId(value: string | null): void {
        this.lineForm.patchValue({ cashDrawerId: value ?? '' });
    }

    setEditCashDrawerId(value: string | null): void {
        this.editMetaForm.patchValue({ cashDrawerId: value ?? '' });
    }

    availableForCreate(productId: string): number {
        const base = this.createStockByProductId.get(productId)?.availableQuantity ?? 0;
        const current = this.draftItems.find(item => item.product.id === productId)?.quantity ?? 0;
        return Math.max(base - current, 0);
    }

    availableForEdit(productId: string): number {
        const base = this.editStockByProductId.get(productId)?.availableQuantity ?? 0;
        const original = this.editOriginalQuantitiesByProductId.get(productId) ?? 0;
        const current = this.editItems.find(item => item.product.id === productId)?.quantity ?? 0;
        return Math.max(base + original - current, 0);
    }

    addDraftItem(): void {
        this.addItem(this.lineForm, this.draftItems);
    }

    addEditItem(): void {
        this.addItem(this.editLineForm, this.editItems);
    }

    handleCreateCustomerInput(query: string): void {
    this.createCustomerQuery = query;
    this.createCustomerId = null;
    this.showCreateCustomerResults = true;
    if (this.customerSearchTimer) {
        clearTimeout(this.customerSearchTimer);
    }
    this.customerSearchTimer = setTimeout(() => {
        this.customerService.searchCustomers(query).subscribe({
            next: results => this.createCustomerSuggestions = results,
            error: () => this.createCustomerSuggestions = []
        });
    }, 300);
}

selectCreateCustomer(customer: CustomerSearchItem): void {
    this.createCustomerId = customer.id;
    this.createCustomerQuery = customer.fullName || customer.name || customer.email;
    this.showCreateCustomerResults = false;
    this.createCustomerSuggestions = [];
}

clearCreateCustomer(): void {
    this.createCustomerId = null;
    this.createCustomerQuery = '';
    this.createCustomerSuggestions = [];
    this.showCreateCustomerResults = false;
}

handleCreateProductInput(query: string): void {
        this.createProductQuery = query;
    }

    selectCreateProduct(product: ProductResponse): void {
        this.createProductQuery = this.productLabel(product);
        this.toggleCreateProductSelection(product, true);
    }

    openCreateProductModal(): void {
        this.createProductModalOpen = true;
    }

    closeCreateProductModal(): void {
        this.createProductModalOpen = false;
    }

    isCreateProductSelected(productId: string): boolean {
        return this.createSelectedProductIds.has(productId);
    }

    createSelectionQuantity(productId: string): number {
        return this.createSelectionQuantityByProductId.get(productId) ?? 1;
    }

    setCreateSelectionQuantity(productId: string, rawValue: string): void {
        const parsed = Number(rawValue);
        const max = Math.max(1, this.availableForCreate(productId));
        const quantity = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : 1;
        this.createSelectionQuantityByProductId.set(productId, quantity);
    }

    toggleCreateProductSelection(product: ProductResponse, checked: boolean): void {
        if (checked && this.availableForCreate(product.id) <= 0) {
            this.toast.error(`Sin stock disponible para ${ product.brand } / ${product.name}.`);
return;
        }

if (checked) {
    this.createSelectedProductIds.add(product.id);
    if (!this.createSelectionQuantityByProductId.has(product.id)) {
        this.createSelectionQuantityByProductId.set(product.id, 1);
    }
    return;
}

this.createSelectedProductIds.delete(product.id);
this.createSelectionQuantityByProductId.delete(product.id);
    }

addSelectedCreateProducts(): void {
    if(this.createSelectedProductIds.size === 0) {
    return;
}

let added = 0;
for (const productId of [...this.createSelectedProductIds]) {
    const product = this.findProduct(productId);
    if (!product) {
        continue;
    }

    const requestedQuantity = this.createSelectionQuantity(product.id);
    const maxAllowed = this.createStockByProductId.get(product.id)?.availableQuantity ?? 0;
    if (this.upsertItem(this.draftItems, product, requestedQuantity, maxAllowed)) {
        added += 1;
    }
}

if (added > 0) {
    this.createSelectedProductIds.clear();
    this.createSelectionQuantityByProductId.clear();
    this.createProductModalOpen = false;
}
    }

handleEditProductInput(query: string): void {
    this.editProductQuery = query;
    this.showEditProductResults = true;
    this.editLineForm.patchValue({ productId: '' });
}

selectEditProduct(product: ProductResponse): void {
    this.editProductQuery = this.productLabel(product);
    this.editLineForm.patchValue({ productId: product.id });
    this.showEditProductResults = false;
}

removeDraftItem(productId: string): void {
    this.draftItems = this.draftItems.filter(item => item.product.id !== productId);
}

removeEditItem(productId: string): void {
    this.editItems = this.editItems.filter(item => item.product.id !== productId);
}

createSale(): void {
    if(this.lineForm.get('branchId')?.invalid || this.draftItems.length === 0) {
    this.lineForm.markAllAsTouched();
    return;
}

if (!this.validatePaymentState(this.lineForm, this.draftItems, this.createPaymentState, 'crear')) {
    return;
}

this.saving = true;
this.saleService.createSale(this.buildRequest(this.lineForm, this.draftItems, this.createPaymentState, this.createCustomerId)).subscribe({
    next: () => {
        this.toast.success('Venta creada');
        const branchId = this.lineForm.get('branchId')?.value ?? '';
        this.draftItems = [];
        this.lineForm.patchValue({ productId: '', quantity: 1, idSaleStatus: 1, hasDelivery: false, cashDrawerId: '' });
        this.createPaymentState = createEmptySalePaymentDraftState();
        this.createProductQuery = '';
        this.createProductModalOpen = false;
        this.createSelectedProductIds.clear();
        this.createSelectionQuantityByProductId.clear();
        this.createCustomerId = null;
        this.createCustomerQuery = '';
        this.createCustomerSuggestions = [];
        this.showCreateCustomerResults = false;
        this.saving = false;
        this.currentSalesPage = 1;
        this.loadStockForBranch(branchId, true);
        this.loadSales();
    },
    error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear la venta');
        this.saving = false;
    }
});
    }

loadSales(): void {
    this.loadingSales = true;
    const selectedStatus = this.optionalNumber(this.filterForm.get('idSaleStatus')?.value);

    this.saleService.listSales({
        dateFrom: this.filterForm.get('dateFrom')?.value || undefined,
        dateTo: this.filterForm.get('dateTo')?.value || undefined,
        idSaleStatus: selectedStatus
    }).subscribe({
        next: sales => {
            this.sales = selectedStatus === 3 ? sales : sales.filter(sale => sale.idSaleStatus !== 3);
            this.ensureSalesPageInRange();
            this.loadingSales = false;
        },
        error: err => {
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las ventas');
            this.loadingSales = false;
        }
    });
}

beginEdit(sale: SaleResponse, presetPaid = false): void {
    if(sale.idSaleStatus !== 1) {
    this.toast.error('Solo se pueden editar ventas en espera');
    return;
}

this.editingSale = sale;
this.editMetaForm.patchValue({ branchId: sale.branchId, idSaleStatus: presetPaid ? 2 : sale.idSaleStatus, hasDelivery: sale.hasDelivery, cashDrawerId: '' });
this.editItems = sale.details
    .map(detail => {
        const product = this.findProduct(detail.productId);
        return product ? { product, quantity: detail.quantity, total: detail.totalAmount } : null;
    })
    .filter((item): item is DraftItem => item !== null);
this.editOriginalQuantitiesByProductId = new Map(
    sale.details.map(detail => [detail.productId, detail.quantity])
);
this.editPaymentState = mapSalePaymentDraftState(sale.payments, sale.tradeIns);

this.loadDrawers(sale.branchId, false);
this.loadStockForBranch(sale.branchId, false);

setTimeout(() => {
    this.editSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
    }

cancelEdit(): void {
    if(this.savingEdit) {
    return;
}

this.editingSale = null;
this.editItems = [];
this.editDrawers = [];
this.editStockByProductId.clear();
this.editOriginalQuantitiesByProductId.clear();
this.editPaymentState = createEmptySalePaymentDraftState();
this.editProductQuery = '';
this.showEditProductResults = false;
    }

saveEdit(): void {
    if(!this.editingSale || this.editItems.length === 0) {
    return;
}

if (!this.validatePaymentState(this.editMetaForm, this.editItems, this.editPaymentState, 'editar')) {
    return;
}

this.savingEdit = true;
this.saleService.updateSale(this.editingSale.id, this.buildRequest(this.editMetaForm, this.editItems, this.editPaymentState, this.editingSale.customerId ?? null)).subscribe({
    next: () => {
        const shouldSuggestWhatsApp = Number(this.editMetaForm.get('idSaleStatus')?.value ?? 1) === 2;
        this.toast.success(shouldSuggestWhatsApp ? 'Venta actualizada. El WhatsApp queda disponible para envio manual.' : 'Venta actualizada');
        const branchId = this.editMetaForm.get('branchId')?.value ?? '';
        this.savingEdit = false;
        this.loadStockForBranch(branchId, false);
        this.cancelEdit();
        this.loadSales();
    },
    error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar la venta');
        this.savingEdit = false;
    }
});
    }

markAsPaid(sale: SaleResponse): void {
    if(sale.idSaleStatus !== 1) {
    return;
}

this.quickPayingSaleId = sale.id;

this.cashService.listCashDrawers(sale.branchId).subscribe({
    next: drawers => {
        const activeDrawers = drawers.filter(item => item.isActive);

        if (activeDrawers.length === 0) {
            this.quickPayingSaleId = null;
            this.toast.error('No hay una caja activa disponible para cobrar esta venta.');
            return;
        }

        forkJoin(
            activeDrawers.map(drawer =>
                this.cashService.getCurrentSession(drawer.id).pipe(
                    map(() => drawer),
                    catchError(() => of(null))
                )
            )
        ).subscribe({
            next: availableDrawers => {
                const drawer = availableDrawers.find((item): item is CashDrawerResponse => item !== null) ?? null;

                if (!drawer) {
                    this.quickPayingSaleId = null;
                    this.toast.error('No hay una caja con sesion abierta disponible para cobrar esta venta.');
                    return;
                }

                const existingPayments = (sale.payments ?? []).map(payment => ({
                    idPaymentMethod: payment.idPaymentMethod,
                    amount: roundMoney(payment.amount),
                    notes: payment.notes ?? null
                }));
                const existingTradeIns = (sale.tradeIns ?? []).map(tradeIn => ({
                    productId: tradeIn.productId,
                    quantity: tradeIn.quantity,
                    amount: roundMoney(tradeIn.amount)
                }));
                const pendingAmount = roundMoney(sale.pendingAmount ?? sale.totalAmount);

                this.saleService.updateSale(sale.id, {
                    branchId: sale.branchId,
                    customerId: sale.customerId ?? null,
                    idSaleStatus: 2,
                    hasDelivery: sale.hasDelivery,
                    cashDrawerId: drawer.id,
                    payments: pendingAmount > 0
                        ? [
                            ...existingPayments,
                            {
                                idPaymentMethod: SALE_PAYMENT_METHOD_CASH,
                                amount: pendingAmount,
                                notes: null
                            }
                        ]
                        : existingPayments,
                    tradeIns: existingTradeIns,
                    details: sale.details.map(detail => ({
                        productId: detail.productId,
                        quantity: detail.quantity
                    }))
                }).subscribe({
                    next: () => {
                        this.quickPayingSaleId = null;
                        this.toast.success('Venta marcada como pagada. El WhatsApp queda listo para envio manual.');
                        this.loadSales();
                    },
                    error: err => {
                        this.quickPayingSaleId = null;
                        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cobrar la venta');
                    }
                });
            },
            error: () => {
                this.quickPayingSaleId = null;
                this.toast.error('No se pudo validar la sesion de caja.');
            }
        });
    },
    error: err => {
        this.quickPayingSaleId = null;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las cajas');
    }
});
    }

sendSaleWhatsApp(sale: SaleResponse, event?: Event): void {
    event?.stopPropagation();

    if (!this.canSendSaleWhatsApp(sale) || this.sendingSaleWhatsAppId) {
        return;
    }

    const whatsappWindow = window.open('about:blank', '_blank');

    this.sendingSaleWhatsAppId = sale.id;
    this.saleService.sendSaleWhatsApp(sale.id).subscribe({
        next: response => {
            this.sendingSaleWhatsAppId = null;
            if (!response.launchUrl) {
                whatsappWindow?.close();
                this.toast.error('No se pudo preparar el enlace de WhatsApp.');
                return;
            }

            if (whatsappWindow) {
                try {
                    whatsappWindow.opener = null;
                } catch {
                    // Ignore browsers that prevent touching opener.
                }
                whatsappWindow.location.href = response.launchUrl;
                return;
            }

            this.toast.error('El navegador bloqueo la nueva pestania de WhatsApp.');
        },
        error: err => {
            this.sendingSaleWhatsAppId = null;
            whatsappWindow?.close();
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo preparar el WhatsApp para esta venta.');
        }
    });
}

requestCancelSale(sale: SaleResponse): void {
    if (sale.idSaleStatus !== 1) {
        return;
    }

    this.cancelSaleModal = sale;
}

closeCancelSaleModal(): void {
    if (this.cancelingSaleId) {
        return;
    }

    this.cancelSaleModal = null;
}

confirmCancelSale(): void {
    if (!this.cancelSaleModal) {
        return;
    }

    const sale = this.cancelSaleModal;
    this.cancelingSaleId = sale.id;
    this.saleService.updateSale(sale.id, {
        branchId: sale.branchId,
        customerId: sale.customerId ?? null,
        idSaleStatus: 3,
        hasDelivery: sale.hasDelivery,
        cashDrawerId: null,
        payments: [],
        tradeIns: [],
        details: sale.details.map(detail => ({
            productId: detail.productId,
            quantity: detail.quantity
        }))
    }).subscribe({
        next: () => {
            this.cancelingSaleId = null;
            this.cancelSaleModal = null;
            this.toast.success('Venta cancelada');
            this.loadSales();
        },
        error: err => {
            this.cancelingSaleId = null;
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cancelar la venta');
        }
    });
}

openTransport(sale: SaleResponse): void {
    if(!sale.hasDelivery) {
    this.toast.error('Esta venta no esta marcada para envio.');
    return;
}

this.transportingSale = sale;
this.currentTransport = null;
this.transportForm.reset({ driverEmployeeId: '', vehicleId: '', notes: '' });

if (!sale.transportAssignmentId) {
    return;
}

this.saleService.getTransport(sale.id).subscribe({
    next: transport => {
        this.currentTransport = transport;
        this.transportForm.patchValue({
            driverEmployeeId: transport.driverEmployeeId,
            vehicleId: transport.vehicleId,
            notes: transport.notes || ''
        });
    },
    error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el detalle del transporte')
});
    }

closeTransport(): void {
    this.transportingSale = null;
    this.currentTransport = null;
}

saveTransport(): void {
    if(!this.transportingSale || this.transportForm.invalid) {
    this.transportForm.markAllAsTouched();
    return;
}

const raw = this.transportForm.getRawValue();
const request = {
    driverEmployeeId: raw.driverEmployeeId,
    vehicleId: raw.vehicleId,
    notes: raw.notes || null
};

const source = this.currentTransport
    ? this.saleService.updateTransport(this.transportingSale.id, request)
    : this.saleService.createTransport(this.transportingSale.id, request);

source.subscribe({
    next: transport => {
        this.currentTransport = transport;
        this.toast.success('Transporte guardado');
        this.loadSales();
    },
    error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo guardar el transporte')
});
    }

setTransportStatus(status: number): void {
    if(!this.transportingSale || !this.currentTransport) {
    return;
}

this.saleService.updateTransportStatus(this.transportingSale.id, status).subscribe({
    next: transport => {
        this.currentTransport = transport;
        this.toast.success('Transporte actualizado');
        this.loadSales();
    },
    error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el estado del transporte')
});
    }

removeTransport(): void {
    if(!this.transportingSale || !this.currentTransport) {
    return;
}

this.saleService.deleteTransport(this.transportingSale.id).subscribe({
    next: () => {
        this.currentTransport = null;
        this.transportForm.reset({ driverEmployeeId: '', vehicleId: '', notes: '' });
        this.toast.success('Transporte desvinculado');
        this.loadSales();
    },
    error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo quitar el transporte')
});
    }

deleteSale(sale: SaleResponse): void {
    if(sale.idSaleStatus !== 3) {
    return;
}

this.deletingSaleId = sale.id;
this.saleService.deleteSale(sale.id).subscribe({
    next: () => {
        this.sales = this.sales.filter(item => item.id !== sale.id);
        this.ensureSalesPageInRange();
        this.deletingSaleId = null;
        this.toast.success('Venta eliminada');
    },
    error: err => {
        this.deletingSaleId = null;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo eliminar la venta');
    }
});
    }

openCustomerInfo(sale: SaleResponse): void {
    if(!sale.customerFullName) {
    return;
}

this.infoModal = {
    title: 'Cliente',
    rows: [
        { label: 'Nombre', value: sale.customerFullName },
        { label: 'Documento', value: sale.customerDocument || '-' },
        { label: 'CUIT', value: sale.customerTaxId || '-' },
        { label: 'Sucursal', value: this.branchName(sale.branchId) }
    ]
};
    }

openDriverInfo(sale: SaleResponse): void {
    if(!sale.driverFullName) {
    return;
}

this.infoModal = {
    title: 'Conductor',
    rows: [
        { label: 'Nombre', value: sale.driverFullName },
        { label: 'Transporte', value: this.transportStatusLabel(sale.transportStatus, sale.transportStatusName) },
        { label: 'Vehiculo', value: sale.vehiclePlate || '-' },
        { label: 'Entrega', value: sale.hasDelivery ? 'Si' : 'No' }
    ]
};
    }

openVehicleInfo(sale: SaleResponse): void {
    if(!sale.vehiclePlate) {
    return;
}

this.infoModal = {
    title: 'Vehiculo',
    rows: [
        { label: 'Patente', value: sale.vehiclePlate },
        { label: 'Conductor', value: sale.driverFullName || '-' },
        { label: 'Transporte', value: this.transportStatusLabel(sale.transportStatus, sale.transportStatusName) },
        { label: 'Sucursal', value: this.branchName(sale.branchId) }
    ]
};
    }

closeInfoModal(): void {
    this.infoModal = null;
}

toggleSaleDetails(saleId: string): void {
    this.expandedSaleId = this.expandedSaleId === saleId ? null : saleId;

    if(this.expandedSaleId === saleId && !this.detailPageBySaleId.has(saleId)) {
    this.detailPageBySaleId.set(saleId, 1);
}
    }

isSaleExpanded(saleId: string): boolean {
    return this.expandedSaleId === saleId;
}

saleDetailPage(saleId: string): number {
    return this.detailPageBySaleId.get(saleId) ?? 1;
}

totalSaleDetailPages(sale: SaleResponse): number {
    return Math.max(1, Math.ceil(sale.details.length / this.detailPageSize));
}

pagedSaleDetails(sale: SaleResponse): SaleDetailResponse[] {
    const page = this.saleDetailPage(sale.id);
    const start = (page - 1) * this.detailPageSize;
    return sale.details.slice(start, start + this.detailPageSize);
}

changeSaleDetailPage(saleId: string, delta: number): void {
    const sale = this.sales.find(item => item.id === saleId);
    if(!sale) {
        return;
    }

        const current = this.saleDetailPage(saleId);
    const next = Math.max(1, Math.min(this.totalSaleDetailPages(sale), current + delta));
    this.detailPageBySaleId.set(saleId, next);
}

exportSaleExcel(sale: SaleResponse): void {
    if(sale.details.length === 0) {
    this.toast.error('La venta no tiene items para exportar.');
    return;
}

const rows = sale.details.map(detail => ({
    Venta: sale.id,
    Fecha: new Date(sale.createdAt).toLocaleString(),
    Sucursal: this.branchName(sale.branchId),
    Cliente: sale.customerFullName || '-',
    'Metodo de pago': this.salePaymentMethodSummary(sale),
    Producto: `${detail.productBrand} / ${detail.productName}`,
    Cantidad: detail.quantity,
    Unitario: detail.unitPrice.toFixed(2),
    Total: detail.totalAmount.toFixed(2)
}));

const worksheet = XLSX.utils.json_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Venta');
XLSX.writeFile(workbook, `venta-${sale.createdAt.slice(0, 10)}.xlsx`, { compression: true });
    }

exportSalePdf(sale: SaleResponse): void {
    if(sale.details.length === 0) {
    this.toast.error('La venta no tiene items para exportar.');
    return;
}

const doc = new jsPDF({ format: 'a4', unit: 'mm' });
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 14;
const contentWidth = pageWidth - margin * 2;
const printableBottom = pageHeight - 18;
const colWidths = [12, 84, 18, 34, 34];
const colX = [
    margin,
    margin + colWidths[0],
    margin + colWidths[0] + colWidths[1],
    margin + colWidths[0] + colWidths[1] + colWidths[2],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
];
const formatCurrency = (value: number): string =>
    `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value: string): string =>
    new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

let y = margin;

const drawDocumentHeader = (): void => {
    doc.setDrawColor(35, 35, 35);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 20, 20);
    doc.text('Comprobante de venta', margin + 4, y + 8);

    doc.setFontSize(10);
    doc.text(`Nro. ${sale.id}`, margin + 4, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Emitido: ${formatDate(new Date().toISOString())}`, pageWidth - margin - 4, y + 8, { align: 'right' });
    doc.text(`Fecha venta: ${formatDate(sale.createdAt)}`, pageWidth - margin - 4, y + 14, { align: 'right' });

    y += 25;
};

const drawMetaBlock = (): void => {
    const metaTop = y;
    const metaHeight = 38;
    const halfWidth = contentWidth / 2;
    const rowHeight = 6.5;
    const leftX = margin + 3;
    const rightX = margin + halfWidth + 3;
    const valueOffset = 19;
    const rowsLeft = [
        ['Sucursal', this.branchName(sale.branchId)],
        ['Cliente', sale.customerFullName || '-'],
        ['Documento', sale.customerDocument || sale.customerTaxId || '-'],
        ['Pago', this.salePaymentMethodSummary(sale)]
    ];
    const rowsRight = [
        ['Estado', this.saleStatusLabel(sale)],
        ['Entrega', sale.hasDelivery ? 'Con envio' : 'Retiro en local'],
        ['Items', `${sale.details.length}`],
        ['Cobrado', formatCurrency(this.saleCoveredAmount(sale))]
    ];

    doc.setDrawColor(185, 185, 185);
    doc.rect(margin, metaTop, contentWidth, metaHeight);
    doc.line(margin + halfWidth, metaTop, margin + halfWidth, metaTop + metaHeight);

    doc.setFontSize(9);
    for (let index = 0; index < rowsLeft.length; index += 1) {
        const rowY = metaTop + 6 + index * rowHeight;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(70, 70, 70);
        doc.text(`${rowsLeft[index][0]}:`, leftX, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(25, 25, 25);
        doc.text(rowsLeft[index][1], leftX + valueOffset, rowY, { maxWidth: halfWidth - valueOffset - 6 });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(70, 70, 70);
        doc.text(`${rowsRight[index][0]}:`, rightX, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(25, 25, 25);
        doc.text(rowsRight[index][1], rightX + valueOffset, rowY, { maxWidth: halfWidth - valueOffset - 6 });
    }

    y = metaTop + metaHeight + 6;
};

const drawItemsHeader = (continuation: boolean): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.text(continuation ? 'Detalle de productos (continuacion)' : 'Detalle de productos', margin, y);
    y += 5;

    doc.setFillColor(232, 232, 232);
    doc.setDrawColor(170, 170, 170);
    doc.rect(margin, y, contentWidth, 8, 'FD');

    doc.setFontSize(8.6);
    doc.text('#', colX[0] + 2, y + 5.3);
    doc.text('Producto', colX[1] + 2, y + 5.3);
    doc.text('Cant.', colX[2] + colWidths[2] - 2, y + 5.3, { align: 'right' });
    doc.text('Unitario', colX[3] + colWidths[3] - 2, y + 5.3, { align: 'right' });
    doc.text('Subtotal', colX[4] + colWidths[4] - 2, y + 5.3, { align: 'right' });

    y += 8;
};

const startDetailsPage = (continuation: boolean): void => {
    if (continuation) {
        doc.addPage();
        y = margin;
    }
    drawItemsHeader(continuation);
};

drawDocumentHeader();
drawMetaBlock();
startDetailsPage(false);

doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(25, 25, 25);

for (let index = 0; index < sale.details.length; index += 1) {
    const detail = sale.details[index];
    const productText = `${detail.productBrand} / ${detail.productName}`;
    const wrappedProduct = doc.splitTextToSize(productText, colWidths[1] - 4) as string[];
    const rowHeight = Math.max(8, wrappedProduct.length * 3.8 + 2.5);

    if (y + rowHeight > printableBottom) {
        startDetailsPage(true);
    }

    doc.setDrawColor(205, 205, 205);
    doc.rect(colX[0], y, colWidths[0], rowHeight);
    doc.rect(colX[1], y, colWidths[1], rowHeight);
    doc.rect(colX[2], y, colWidths[2], rowHeight);
    doc.rect(colX[3], y, colWidths[3], rowHeight);
    doc.rect(colX[4], y, colWidths[4], rowHeight);

    doc.text(`${index + 1}`, colX[0] + 2, y + rowHeight / 2 + 1.2);
    doc.text(wrappedProduct, colX[1] + 2, y + 4.6);
    doc.text(`${detail.quantity}`, colX[2] + colWidths[2] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
    doc.text(formatCurrency(detail.unitPrice), colX[3] + colWidths[3] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
    doc.text(formatCurrency(detail.totalAmount), colX[4] + colWidths[4] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });

    y += rowHeight;
}

if (y + 24 > printableBottom) {
    doc.addPage();
    y = margin;
}

const summaryWidth = 72;
const summaryX = pageWidth - margin - summaryWidth;
doc.setFillColor(246, 246, 246);
doc.setDrawColor(150, 150, 150);
doc.roundedRect(summaryX, y + 5, summaryWidth, 16, 1.2, 1.2, 'FD');
doc.setFont('helvetica', 'bold');
doc.setTextColor(45, 45, 45);
doc.setFontSize(9.5);
doc.text('TOTAL VENTA', summaryX + 3, y + 11);
doc.setFontSize(12.5);
doc.text(formatCurrency(sale.totalAmount), summaryX + summaryWidth - 3, y + 17, { align: 'right' });

const pageCount = doc.getNumberOfPages();
for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(205, 205, 205);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Documento para control interno de venta', margin, pageHeight - 8);
    doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
}

doc.save(`venta-${sale.createdAt.slice(0, 10)}.pdf`);
    }

branchName(branchId: string): string {
    return this.branches.find(branch => branch.id === branchId)?.name ?? 'Sin sucursal';
}

saleStatusLabel(sale: SaleResponse): string {
    switch (sale.idSaleStatus) {
        case 1:
            return 'En espera';
        case 2:
            return 'Pagada';
        case 3:
            return 'Cancelada';
        default:
            return sale.saleStatus;
    }
}

saleStatusChipClass(sale: SaleResponse): string {
    switch (sale.idSaleStatus) {
        case 1:
            return 'chip--sale-pending';
        case 2:
            return 'chip--sale-paid';
        case 3:
            return 'chip--sale-cancelled';
        default:
            return 'chip--neutral';
    }
}

transportStatusLabel(status ?: number | null, fallback ?: string | null): string {
    switch (status) {
        case 1:
            return 'Asignado';
        case 2:
            return 'En transito';
        case 3:
            return 'Entregado';
        case 4:
            return 'Cancelado';
        default:
            return fallback ?? '-';
    }
}

transportStatusChipLabel(sale: SaleResponse): string {
    if (!sale.hasDelivery) {
        return 'No aplica';
    }

    if (!sale.transportAssignmentId) {
        return 'Pendiente';
    }

    return this.transportStatusLabel(sale.transportStatus, sale.transportStatusName);
}

transportStatusChipClass(sale: SaleResponse): string {
    if (!sale.hasDelivery) {
        return 'chip--transport-na';
    }

    if (!sale.transportAssignmentId) {
        return 'chip--transport-pending';
    }

    switch (sale.transportStatus) {
        case 1:
            return 'chip--transport-assigned';
        case 2:
            return 'chip--transport-transit';
        case 3:
            return 'chip--transport-delivered';
        case 4:
            return 'chip--transport-cancelled';
        default:
            return 'chip--neutral';
    }
}

salePaymentMethodSummary(sale: SaleResponse): string {
    return paymentMethodSummary(sale.payments, sale.tradeIns);
}

saleCoveredAmount(sale: SaleResponse): number {
    return roundMoney(
        (sale.payments ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
        + (sale.tradeIns ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    );
}

trackByItem(_: number, item: DraftItem): string {
    return item.product.id;
}

trackBySale(_: number, sale: SaleResponse): string {
    return sale.id;
}

applySaleFilters(): void {
    this.currentSalesPage = 1;
    this.loadSales();
}

clearSaleFilters(): void {
    this.filterForm.reset({ dateFrom: '', dateTo: '', idSaleStatus: '' });
    this.currentSalesPage = 1;
    this.loadSales();
}

goToSalesPage(page: number): void {
    if(page < 1 || page > this.totalSalesPages || page === this.currentSalesPage) {
    return;
}

this.currentSalesPage = page;
    }

changeSalesPageSize(rawPageSize: string): void {
    const parsedPageSize = Number(rawPageSize);

    if(!Number.isFinite(parsedPageSize) || parsedPageSize <= 0 || parsedPageSize === this.salesPageSize) {
    return;
}

this.salesPageSize = parsedPageSize;
this.currentSalesPage = 1;
    }

@HostListener('document:click', ['$event'])
handleDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;

    if(this.showEditProductResults && this.editProductPicker && target && !this.editProductPicker.nativeElement.contains(target)) {
    this.showEditProductResults = false;
}

    if (this.showCreateCustomerResults) {
        this.showCreateCustomerResults = false;
    }
    }

    private loadProducts(): void {
    this.loadingProducts = true;
    this.productService.listProducts().subscribe({
        next: products => {
            this.products = [...products].sort((left, right) => this.productLabel(left).localeCompare(this.productLabel(right)));
            this.loadingProducts = false;
        },
        error: err => {
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los productos');
            this.loadingProducts = false;
        }
    });
}

    private loadWhatsAppConfig(): void {
    this.companyService.getCurrentCompany().subscribe({
        next: company => {
            this.whatsAppEnabled = Boolean(company.isWhatsAppEnabled ?? company.whatsAppEnabled);
            this.whatsAppPhoneNumber = company.whatsAppSenderPhone ?? company.whatsAppPhoneNumber ?? null;
        }
    });
}

    private loadBranches(): void {
    this.branchService.listBranches().subscribe({
        next: branches => {
            this.branches = branches;

            if (!this.lineForm.get('branchId')?.value && branches.length > 0) {
                this.lineForm.patchValue({ branchId: branches[0].id });
                this.handleCreateBranchChange();
            }
        },
        error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las sucursales')
    });
}

    private loadDrivers(): void {
    this.employeeService.listDrivers().subscribe({
        next: drivers => this.drivers = drivers.filter(driver => driver.isActive && !driver.isLicenseExpired),
        error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los conductores')
    });
}

    private loadVehicles(): void {
    this.vehicleService.listVehicles().subscribe({
        next: vehicles => this.vehicles = vehicles,
        error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los vehiculos')
    });
}

    private loadDrawers(branchId: string, isCreate: boolean): void {
    if(!branchId) {
        if (isCreate) {
            this.createDrawers = [];
        } else {
            this.editDrawers = [];
        }
        return;
    }

        this.cashService.listCashDrawers(branchId).subscribe({
        next: drawers => {
            const activeDrawers = drawers.filter(drawer => drawer.isActive);

            if (activeDrawers.length === 0) {
                if (isCreate) {
                    this.createDrawers = [];
                } else {
                    this.editDrawers = [];
                }
                return;
            }

            forkJoin(
                activeDrawers.map(drawer =>
                    this.cashService.getCurrentSession(drawer.id).pipe(
                        map(() => drawer),
                        catchError(() => of(null))
                    )
                )
            ).subscribe({
                next: availableDrawers => {
                    const target = availableDrawers.filter((drawer): drawer is CashDrawerResponse => drawer !== null);
                    if (isCreate) {
                        this.createDrawers = target;
                    } else {
                        this.editDrawers = target;
                    }
                },
                error: () => {
                    if (isCreate) {
                        this.createDrawers = [];
                    } else {
                        this.editDrawers = [];
                    }
                }
            });
        },
        error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las cajas')
    });
}

    private loadStockForBranch(branchId: string, isCreate: boolean): void {
    const target = isCreate ? this.createStockByProductId : this.editStockByProductId;
    target.clear();

    if(!branchId) {
        return;
    }

        this.stockService.listBranchStock(branchId).subscribe({
        next: items => {
            for (const item of items) {
                target.set(item.productId, item);
            }
        },
        error: () => target.clear()
    });
}

    private addItem(form: FormGroup, target: DraftItem[]): void {
    const product = this.findProduct(form.get('productId')?.value);

    if(!product || form.get('productId')?.invalid || form.get('quantity')?.invalid) {
    form.markAllAsTouched();
    return;
}

const quantity = Number(form.get('quantity')?.value ?? 0);
const createAvailable = this.createStockByProductId.get(product.id)?.availableQuantity ?? 0;
const editAvailable = this.editStockByProductId.get(product.id)?.availableQuantity ?? 0;
const originalReserved = this.editOriginalQuantitiesByProductId.get(product.id) ?? 0;
const maxAllowed = form === this.lineForm
    ? createAvailable
    : editAvailable + originalReserved;
if (!this.upsertItem(target, product, quantity, maxAllowed)) {
    return;
}

form.patchValue({ productId: '', quantity: 1 });

if (form === this.lineForm) {
    this.createProductQuery = '';
}

if (form === this.editLineForm) {
    this.editProductQuery = '';
    this.showEditProductResults = false;
}
    }

    private upsertItem(target: DraftItem[], product: ProductResponse, quantity: number, maxAllowed: number): boolean {
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return false;
    }

    const existing = target.find(item => item.product.id === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + Math.floor(quantity);

    if (nextQuantity > maxAllowed) {
        this.toast.error(`No hay stock suficiente para ${product.brand} / ${product.name}. Disponible: ${Math.max(maxAllowed, 0)}.`);
        return false;
    }

    if (existing) {
        existing.quantity = nextQuantity;
        existing.total = existing.quantity * productPublicPrice(existing.product);
    } else {
        target.unshift({ product, quantity: Math.floor(quantity), total: productPublicPrice(product) * Math.floor(quantity) });
    }

    return true;
}

    private buildRequest(form: FormGroup, items: DraftItem[], paymentState: SalePaymentDraftState, customerId: string | null = null) {
    const raw = form.getRawValue();
    return {
        branchId: raw.branchId,
        customerId,
        idSaleStatus: Number(raw.idSaleStatus ?? 1),
        hasDelivery: Boolean(raw.hasDelivery),
        cashDrawerId: this.requiresCashDrawerFor(form, paymentState) ? raw.cashDrawerId || null : null,
        payments: normalizeSalePayments(paymentState),
        tradeIns: normalizeSaleTradeIns(paymentState),
        details: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity
        }))
    };
}

    canSendSaleWhatsApp(sale: SaleResponse): boolean {
    return this.whatsAppEnabled
        && Boolean(this.whatsAppPhoneNumber)
        && sale.idSaleStatus === 2
        && Boolean(sale.customerId);
}

    private validatePaymentState(form: FormGroup, items: DraftItem[], paymentState: SalePaymentDraftState, mode: 'crear' | 'editar'): boolean {
    const total = roundMoney(this.sum(items));
    const payments = normalizeSalePayments(paymentState);
    const tradeIns = normalizeSaleTradeIns(paymentState);
    const coverage = roundMoney(
        payments.reduce((sum, item) => sum + item.amount, 0)
        + tradeIns.reduce((sum, item) => sum + item.amount, 0)
    );
    const isPaid = Number(form.get('idSaleStatus')?.value ?? 1) === 2;

    if (paymentState.hasTradeIn) {
        const hasIncompleteTradeIn = paymentState.tradeIns.some(item =>
            (item.productId && (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0 || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0))
            || (!item.productId && (Number(item.amount) > 0 || Number(item.quantity) > 1))
        );

        if (hasIncompleteTradeIn) {
            this.toast.error('Completa producto, cantidad y monto en cada item de canje.');
            return false;
        }
    }

    if (isPaid && coverage !== total) {
        this.toast.error(`La venta ${mode === 'crear' ? 'a crear' : 'editada'} debe quedar cancelada exacta con payments + tradeIns.`);
        return false;
    }

    if (!isPaid && coverage > total) {
        this.toast.error('Una venta en espera puede ser parcial, pero no superar el total.');
        return false;
    }

    if (this.requiresCashDrawerFor(form, paymentState) && !form.get('cashDrawerId')?.value) {
        this.toast.error('Selecciona una caja abierta si hay efectivo en una venta pagada.');
        return false;
    }

    return true;
}

    private requiresCashDrawerFor(form: FormGroup, paymentState: SalePaymentDraftState): boolean {
    return Number(form.get('idSaleStatus')?.value ?? 1) === 2 && hasCashPayment(paymentState);
}

    private optionalNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    return Number(value);
}

    private ensureSalesPageInRange(): void {
    this.currentSalesPage = Math.min(this.currentSalesPage, this.totalSalesPages);
}

    private sum(items: DraftItem[]): number {
    return items.reduce((total, item) => total + item.total, 0);
}

    private findProduct(productId: unknown): ProductResponse | null {
    const id = typeof productId === 'string' ? productId : '';
    return this.products.find(product => product.id === id) ?? null;
}

    private filterProducts(query: string): ProductResponse[] {
    const normalized = query.trim().toLowerCase();

    return this.products
        .filter(product => {
            if (!normalized) {
                return true;
            }

            const haystack = `${product.code} ${product.sku} ${product.brand} ${product.name} ${product.description || ''} ${product.id}`.toLowerCase();
            return haystack.includes(normalized);
        })
        .slice(0, 20);
}

    private productLabel(product: ProductResponse): string {
    return `${product.code} Â· ${product.brand} / ${product.name}`;
}
}

interface DraftItem {
    product: ProductResponse;
    quantity: number;
    total: number;
}

