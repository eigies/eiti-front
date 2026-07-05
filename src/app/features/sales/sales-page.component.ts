import { Component, DestroyRef, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, Subject, switchMap } from 'rxjs';
import * as XLSX from 'xlsx';
import { ProductService } from '../../core/services/product.service';
import { SaleService } from '../../core/services/sale.service';
import { CompanyService } from '../../core/services/company.service';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerSearchItem } from '../../core/models/customer.models';
import { ProductResponse, productPublicPrice } from '../../core/models/product.models';
import { CreateSaleRequest, SaleDetailResponse, SaleResponse, SaleSourceChannel, SALE_SOURCE_CHANNELS } from '../../core/models/sale.models';
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
import { RemitoPdfService } from '../../shared/services/remito-pdf.service';
import { SalePaymentInlineComponent } from '../../shared/components/sale-payment-inline/sale-payment-inline.component';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { QuickSaleWorkspaceComponent } from './components/quick-sale-workspace/quick-sale-workspace.component';
import {
    QuickSaleSummaryComponent,
    QuickSaleSummaryItem
} from './components/quick-sale-summary/quick-sale-summary.component';
import { SaleActionsMenuComponent } from './components/sale-actions-menu/sale-actions-menu.component';
import { SalesManagementComponent } from './components/sales-management/sales-management.component';
import { SaleListItemComponent } from './components/sale-list-item/sale-list-item.component';
import { BankService } from '../../core/services/bank.service';
import { BankResponse } from '../../core/models/bank.models';
import {
    SalePaymentDraftState,
    createEmptySalePaymentDraftState,
    hasCashPayment,
    mapSalePaymentDraftState,
    normalizeSalePayments,
    normalizeSaleTradeIns,
    paymentMethodSummary,
    SALE_PAYMENT_METHOD_CASH,
    SALE_PAYMENT_METHODS,
    roundMoney
} from '../../core/models/sale-payment.models';
import { QuickSaleStage, SalesPageMode, SaleUiAction } from './sales-page-ui.models';
import { ProductPickerModalComponent } from '../../shared/components/product-picker-modal/product-picker-modal.component';
import { ProductPickerRow, ProductPickerSelection, toProductPickerRow } from '../../shared/components/product-picker-modal/product-picker-modal.models';

function localDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

@Component({
    selector: 'app-sales-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        OnboardingBannerComponent,
        SalePaymentInlineComponent,
        SearchableSelectComponent,
        QuickSaleWorkspaceComponent,
        QuickSaleSummaryComponent,
        SaleActionsMenuComponent,
        SalesManagementComponent,
        SaleListItemComponent,
        ProductPickerModalComponent
    ],
    templateUrl: './sales-page.component.html',
    styleUrls: ['./sales-page.component.css']
})
export class SalesPageComponent implements OnInit {
    readonly permissionCodes = PermissionCodes;
    @ViewChild('createProductDraft') createProductDraft?: ElementRef<HTMLElement>;
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
    banks: BankResponse[] = [];
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
    showStaleCashSessionModal = false;
    showNoCashSessionModal = false;
    deletingSaleId: string | null = null;
    cancelingSaleId: string | null = null;
    quickPayingSaleId: string | null = null;
    sendingSaleWhatsAppId: string | null = null;
    editProductQuery = '';
    showEditProductResults = false;
    createProductModalOpen = false;
    createPickerRows: ProductPickerRow[] = [];
    createCustomerId: string | null = null;
    createCustomerQuery = '';
    createCustomerSuggestions: CustomerSearchItem[] = [];
    showCreateCustomerResults = false;
    private readonly destroyRef = inject(DestroyRef);
    // Búsquedas con debounce + switchMap (cancela la request anterior → sin race conditions).
    private readonly customerSearch$ = new Subject<string>();
    private readonly addressSearch$ = new Subject<string>();
    quickCreateCustomerOpen = false;
    quickCreateCustomerName = '';
    quickCreateCustomerPhone = '';
    quickCreateCustomerSaving = false;
    deliveryAddressSuggestions: string[] = [];
    showDeliveryAddressSuggestions = false;
    createPaymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
    editPaymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
    defaultNoDeliverySurcharge = 0;
    activeMode: SalesPageMode = 'sell';
    activeCreateStage: QuickSaleStage = 'config';
    showOnboardingCompleteNotice = false;
    infoModal: { title: string; rows: Array<{ label: string; value: string }> } | null = null;
    cancelSaleModal: SaleResponse | null = null;
    expandedSaleId: string | null = null;
    whatsAppEnabled = false;
    whatsAppPhoneNumber: string | null = null;
    readonly salesPageSizeOptions = [10, 25, 50];
    readonly detailPageSize = 5;
    readonly saleStatusOptions: SearchableSelectOption[] = [
        { value: 1, label: 'En espera' },
        { value: 2, label: 'Pagada' }
    ];
    readonly saleFilterStatusOptions: SearchableSelectOption[] = [
        { value: 1, label: 'En espera' },
        { value: 2, label: 'Pagada' },
        { value: 3, label: 'Cancelada' }
    ];
    readonly transportStatusOptions: SearchableSelectOption[] = [
        { value: 'pending', label: 'Pendiente' },
        { value: '1', label: 'Asignado' },
        { value: '2', label: 'En transito' },
        { value: '3', label: 'Entregado' },
        { value: '4', label: 'Cancelado' }
    ];
    currentSalesPage = 1;
    salesPageSize = 10;
    private readonly detailPageBySaleId = new Map<string, number>();
    readonly saleSourceChannels = SALE_SOURCE_CHANNELS;
    showCreateChannelDrop = false;
    showEditChannelDrop   = false;
    channelPopupSale: SaleResponse | null = null;
    channelPopupValue: SaleSourceChannel | null = null;
    savingChannel = false;
    showDrawerOverrideConfirm = false;
    pendingOverrideDrawerId: string | null = null;
    pendingOverrideIsCreate = true;

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
        private bankService: BankService,
        private remitoPdf: RemitoPdfService,
        public auth: AuthService
    ) {
        this.lineForm = this.fb.group({
            branchId: ['', Validators.required],
            idSaleStatus: [1, Validators.required],
            hasDelivery: [false],
            cashDrawerId: [''],
            sourceChannel: [null, Validators.required],
            deliveryAddress: [''],
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
            cashDrawerId: [''],
            sourceChannel: [null],
            deliveryAddress: ['']
        });
        this.transportForm = this.fb.group({
            driverEmployeeId: ['', Validators.required],
            vehicleId: ['', Validators.required],
            notes: ['']
        });
        const today = localDateString();
        this.filterForm = this.fb.group({ dateFrom: [today], dateTo: [''], idSaleStatus: [''], sourceChannel: [''], transportStatus: [''], code: [''], phone: [''], deliveryAddress: [''] });
    }

    ngOnInit(): void {
        this.customerSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(q => this.customerService.searchCustomers(q).pipe(
                catchError(() => of([] as CustomerSearchItem[])))),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(results => this.createCustomerSuggestions = results);

        this.addressSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(v => v.trim()
                ? this.saleService.searchDeliveryAddresses(v).pipe(catchError(() => of([] as string[])))
                : of([] as string[])),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(results => this.deliveryAddressSuggestions = results);

        this.showOnboardingCompleteNotice = this.onboardingService.consumeCompletionNotice();
        this.loadProducts();
        this.loadBranches();
        this.loadSales();
        this.loadDrivers();
        this.loadVehicles();
        this.loadWhatsAppConfig();
        this.bankService.listBanks(true).subscribe({ next: banks => this.banks = banks, error: () => {} });
    }

    get selectedProduct(): ProductResponse | null {
        return this.findProduct(this.lineForm.get('productId')?.value);
    }

    get draftTotal(): number {
        return roundMoney(this.sum(this.draftItems) + this.createAutoSurcharge);
    }

    get draftEffectiveTotal(): number {
        const cardSurcharge = roundMoney(this.createPaymentState.payments.reduce((sum, p) => sum + (p.cardSurchargeAmt ?? 0), 0));
        return roundMoney(this.draftTotal + cardSurcharge);
    }

    get quickSaleSummaryItems(): QuickSaleSummaryItem[] {
        return this.draftItems.map(item => ({
            id: item.product.id,
            label: `${item.product.brand} / ${item.product.name}`,
            quantity: item.quantity,
            subtotal: item.total
        }));
    }

    get editTotal(): number {
        return roundMoney(this.sum(this.editItems) + this.editAutoSurcharge);
    }

    get createAutoSurcharge(): number {
        if (this.createPaymentState.hasTradeIn) return 0;
        return roundMoney(
            this.draftItems.reduce((sum, item) => sum + item.quantity * this.getProductSurcharge(item.product), 0)
        );
    }

    get editAutoSurcharge(): number {
        if (this.editPaymentState.hasTradeIn) return 0;
        return roundMoney(
            this.editItems.reduce((sum, item) => sum + item.quantity * this.getProductSurcharge(item.product), 0)
        );
    }

    private getProductSurcharge(product: ProductResponse): number {
        if (product.noDeliverySurcharge != null && product.noDeliverySurcharge > 0) {
            return product.noDeliverySurcharge;
        }
        return this.defaultNoDeliverySurcharge;
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

    get branchOptions(): SearchableSelectOption[] {
        return this.branches.map(branch => ({
            value: branch.id,
            label: branch.name
        }));
    }

    get driverOptions(): SearchableSelectOption[] {
        return this.drivers.map(driver => ({
            value: driver.employeeId,
            label: driver.fullName
        }));
    }

    get vehicleOptions(): SearchableSelectOption[] {
        return this.activeVehicles.map(vehicle => ({
            value: vehicle.id,
            label: `${vehicle.plate} / ${vehicle.model}`,
            meta: vehicle.model
        }));
    }

    get salesPageSizeSelectOptions(): SearchableSelectOption[] {
        return this.salesPageSizeOptions.map(option => ({
            value: option,
            label: String(option)
        }));
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

    setActiveMode(mode: SalesPageMode): void {
        this.activeMode = mode;
    }

    setActiveCreateStage(stage: QuickSaleStage): void {
        this.activeCreateStage = stage;
    }

    handleSummaryProductsRequested(): void {
        this.activeCreateStage = 'products';
        window.setTimeout(() => {
            const productDraft = this.createProductDraft?.nativeElement;
            productDraft?.focus({ preventScroll: true });
            productDraft?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    get isCreateConfigComplete(): boolean {
        return Boolean(
            this.lineForm.get('branchId')?.valid
            && this.lineForm.get('sourceChannel')?.valid
        );
    }

    get isCreateProductsComplete(): boolean {
        return this.draftItems.length > 0;
    }

    get hasActiveOptionalSaleFilters(): boolean {
        const raw = this.filterForm.getRawValue();
        return [
            raw.code,
            raw.dateTo,
            raw.idSaleStatus,
            raw.sourceChannel,
            raw.transportStatus,
            raw.phone,
            raw.deliveryAddress
        ].some(value => value !== null && value !== undefined && String(value).trim() !== '');
    }

    get createBranchLabel(): string {
        const branchId = this.lineForm.get('branchId')?.value;
        return this.branches.find(branch => branch.id === branchId)?.name ?? 'Sin seleccionar';
    }

    get createChannelLabel(): string {
        const channel = this.optionalNumber(this.lineForm.get('sourceChannel')?.value);
        return this.saleSourceChannels.find(item => item.value === channel)?.label ?? 'Sin seleccionar';
    }

    get createDeliveryLabel(): string {
        if (!this.lineForm.get('hasDelivery')?.value) {
            return 'Retira cliente';
        }

        return this.lineForm.get('deliveryAddress')?.value || 'Con envío';
    }

    get createCustomerLabel(): string {
        return this.createCustomerId ? this.createCustomerQuery : 'Consumidor final';
    }

    handleQuickSalePrimaryAction(): void {
        if (this.activeCreateStage === 'config') {
            this.activeCreateStage = 'products';
            return;
        }

        if (this.activeCreateStage === 'products') {
            this.activeCreateStage = 'payment';
            return;
        }

        this.createSale();
    }

    handleSaleUiAction(sale: SaleResponse, action: SaleUiAction): void {
        switch (action) {
            case 'details':
                this.toggleSaleDetails(sale.id);
                break;
            case 'customer':
                this.openCustomerInfo(sale);
                break;
            case 'driver':
                this.openDriverInfo(sale);
                break;
            case 'vehicle':
                this.openVehicleInfo(sale);
                break;
            case 'transport':
                this.openTransport(sale);
                break;
            case 'channel':
                this.openChannelPopup(sale);
                break;
            case 'excel':
                this.exportSaleExcel(sale);
                break;
            case 'pdf':
                this.exportSalePdf(sale);
                break;
            case 'remito':
                this.exportRemitoTraslado(sale);
                break;
            case 'whatsapp':
                this.sendSaleWhatsApp(sale);
                break;
            case 'cancel':
                this.requestCancelSale(sale);
                break;
            case 'edit':
                this.beginEdit(sale);
                break;
            case 'pay':
                this.markAsPaid(sale);
                break;
        }
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
        const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? null;
        if (assignedId && value && value !== assignedId && !this.auth.hasPermission(PermissionCodes.cashDrawerViewAll)) {
            this.pendingOverrideDrawerId = value;
            this.pendingOverrideIsCreate = true;
            this.showDrawerOverrideConfirm = true;
            return;
        }
        this.lineForm.patchValue({ cashDrawerId: value ?? '' });
    }

    setEditCashDrawerId(value: string | null): void {
        const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? null;
        if (assignedId && value && value !== assignedId && !this.auth.hasPermission(PermissionCodes.cashDrawerViewAll)) {
            this.pendingOverrideDrawerId = value;
            this.pendingOverrideIsCreate = false;
            this.showDrawerOverrideConfirm = true;
            return;
        }
        this.editMetaForm.patchValue({ cashDrawerId: value ?? '' });
    }

    confirmDrawerOverride(): void {
        if (this.pendingOverrideIsCreate) {
            this.lineForm.patchValue({ cashDrawerId: this.pendingOverrideDrawerId ?? '' });
        } else {
            this.editMetaForm.patchValue({ cashDrawerId: this.pendingOverrideDrawerId ?? '' });
        }
        this.showDrawerOverrideConfirm = false;
        this.pendingOverrideDrawerId = null;
    }

    cancelDrawerOverride(): void {
        const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? '';
        if (this.pendingOverrideIsCreate) {
            this.lineForm.patchValue({ cashDrawerId: assignedId });
        } else {
            this.editMetaForm.patchValue({ cashDrawerId: assignedId });
        }
        this.showDrawerOverrideConfirm = false;
        this.pendingOverrideDrawerId = null;
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
    this.customerSearch$.next(query);
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

openQuickCreateCustomer(): void {
    this.quickCreateCustomerName = this.createCustomerQuery.trim();
    this.quickCreateCustomerPhone = '';
    this.quickCreateCustomerOpen = true;
    this.showCreateCustomerResults = false;
}

closeQuickCreateCustomer(): void {
    this.quickCreateCustomerOpen = false;
    this.quickCreateCustomerName = '';
    this.quickCreateCustomerPhone = '';
}

submitQuickCreateCustomer(): void {
    const name = this.quickCreateCustomerName.trim();
    if (!name) return;
    this.quickCreateCustomerSaving = true;
    this.customerService.createCustomer({
        name,
        email: null,
        phone: this.quickCreateCustomerPhone.trim() || null,
    }).subscribe({
        next: (customer) => {
            this.quickCreateCustomerSaving = false;
            this.quickCreateCustomerOpen = false;
            this.createCustomerId = customer.id;
            this.createCustomerQuery = customer.fullName || customer.name || name;
            this.quickCreateCustomerName = '';
            this.quickCreateCustomerPhone = '';
            this.toast.success('Cliente creado');
        },
        error: () => {
            this.quickCreateCustomerSaving = false;
            this.toast.error('Error al crear el cliente');
        },
    });
}

handleDeliveryAddressInput(form: FormGroup, value: string): void {
    form.get('deliveryAddress')?.setValue(value, { emitEvent: false });
    this.showDeliveryAddressSuggestions = value.length > 0;
    if (!value.trim()) {
        this.deliveryAddressSuggestions = [];
        return;
    }
    this.addressSearch$.next(value);
}

selectDeliveryAddress(form: FormGroup, address: string): void {
    form.get('deliveryAddress')?.setValue(address);
    this.deliveryAddressSuggestions = [];
    this.showDeliveryAddressSuggestions = false;
}

    openCreateProductModal(): void {
        this.createPickerRows = this.products.map(product =>
            toProductPickerRow(product, this.availableForCreate(product.id))
        );
        this.createProductModalOpen = true;
    }

    closeCreateProductModal(): void {
        this.createProductModalOpen = false;
        this.createPickerRows = [];
    }

    onCreatePickerConfirm(selection: ProductPickerSelection[]): void {
        let added = 0;
        for (const { id, quantity } of selection) {
            const product = this.findProduct(id);
            if (!product) {
                continue;
            }
            const maxAllowed = this.createStockByProductId.get(product.id)?.availableQuantity ?? 0;
            if (this.upsertItem(this.draftItems, product, quantity, maxAllowed)) {
                added += 1;
            }
        }
        if (added > 0) {
            this.closeCreateProductModal();
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
    if (!this.isCreateConfigComplete) {
    this.activeCreateStage = 'config';
} else if (!this.isCreateProductsComplete) {
    this.activeCreateStage = 'products';
}

    if(this.lineForm.get('branchId')?.invalid || this.lineForm.get('sourceChannel')?.invalid || this.draftItems.length === 0) {
    this.lineForm.markAllAsTouched();
    if (this.lineForm.get('sourceChannel')?.invalid) {
        this.toast.error('Seleccioná el canal de origen de la venta.');
    }
    return;
}

if (!this.validatePaymentState(this.lineForm, this.draftTotal, this.createPaymentState, 'crear')) {
    return;
}

this.saving = true;
this.saleService.createSale(this.buildRequest(this.lineForm, this.draftItems, this.createPaymentState, this.createCustomerId, this.createAutoSurcharge)).subscribe({
    next: (response) => {
        this.toast.success('Venta creada');
        if ((response?.changeAmount ?? 0) > 0) {
            this.toast.show(`Vuelto a entregar: $${response.changeAmount!.toFixed(2)}`, 'info');
        }
        const branchId = this.lineForm.get('branchId')?.value ?? '';
        this.draftItems = [];
        this.lineForm.patchValue({ productId: '', quantity: 1, idSaleStatus: 1, hasDelivery: false, cashDrawerId: '', sourceChannel: null, deliveryAddress: '' });
        this.createPaymentState = createEmptySalePaymentDraftState();
        this.createProductModalOpen = false;
        this.createPickerRows = [];
        this.createCustomerId = null;
        this.createCustomerQuery = '';
        this.createCustomerSuggestions = [];
        this.showCreateCustomerResults = false;
        this.activeCreateStage = 'config';
        this.saving = false;
        this.currentSalesPage = 1;
        this.loadDrawers(branchId, true);
        this.loadStockForBranch(branchId, true);
        this.loadSales();
    },
    error: err => {
        this.saving = false;
        this.handleSaleChargeError(err, 'No se pudo crear la venta');
    }
});
    }

    // Centraliza el manejo de errores de caja al cobrar una venta (crear/editar/cobro rapido):
    // - sesion del dia anterior -> modal de sesion vieja
    // - sin cajon resuelto / sin sesion abierta -> modal "sin caja disponible"
    // - resto -> toast con el detalle del backend
    private handleSaleChargeError(err: unknown, fallbackMessage: string): void {
        const error = (err as { error?: { errorCode?: string; detail?: string; message?: string } })?.error;
        const code = error?.errorCode ?? '';
        if (code.endsWith('CashSessionFromPreviousDay')) {
            this.showStaleCashSessionModal = true;
            return;
        }
        if (code.endsWith('CashDrawerRequired') || code.endsWith('CashSessionRequired')) {
            this.showNoCashSessionModal = true;
            return;
        }
        this.toast.error(error?.detail || error?.message || fallbackMessage);
    }

loadSales(): void {
    this.loadingSales = true;
    const selectedStatus = this.optionalNumber(this.filterForm.get('idSaleStatus')?.value);
    const selectedChannel = this.optionalNumber(this.filterForm.get('sourceChannel')?.value);

    this.saleService.listSales({
        dateFrom: this.filterForm.get('dateFrom')?.value || undefined,
        dateTo: this.filterForm.get('dateTo')?.value || undefined,
        idSaleStatus: selectedStatus
    }).subscribe({
        next: sales => {
            let filtered = sales;
            if (selectedChannel) {
                filtered = filtered.filter(sale => sale.sourceChannel === selectedChannel);
            }
            const transportStatus = this.filterForm.get('transportStatus')?.value;
            if (transportStatus === 'pending') {
                filtered = filtered.filter(sale => sale.hasDelivery && !sale.transportStatus);
            } else if (transportStatus !== '' && transportStatus !== null && transportStatus !== undefined) {
                const ts = Number(transportStatus);
                filtered = filtered.filter(sale => sale.transportStatus === ts);
            }
            const codeQuery = (this.filterForm.get('code')?.value || '').trim().toLowerCase();
            if (codeQuery) {
                filtered = filtered.filter(sale =>
                    (sale.code || '').toLowerCase().includes(codeQuery)
                );
            }
            const phoneQuery = (this.filterForm.get('phone')?.value || '').replace(/\D/g, '');
            if (phoneQuery) {
                filtered = filtered.filter(sale =>
                    (sale.customerPhone || '').replace(/\D/g, '').includes(phoneQuery)
                );
            }
            const addressQuery = (this.filterForm.get('deliveryAddress')?.value || '').trim().toLowerCase();
            if (addressQuery) {
                filtered = filtered.filter(sale =>
                    (sale.deliveryAddress || '').toLowerCase().includes(addressQuery) ||
                    (sale.customerAddress || '').toLowerCase().includes(addressQuery)
                );
            }
            this.sales = filtered;
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
this.editMetaForm.patchValue({ branchId: sale.branchId, idSaleStatus: presetPaid ? 2 : sale.idSaleStatus, hasDelivery: sale.hasDelivery, cashDrawerId: sale.cashDrawerId ?? '', sourceChannel: sale.sourceChannel ?? null, deliveryAddress: sale.deliveryAddress ?? '' });
this.editItems = sale.details
    .map(detail => {
        const product = this.findProduct(detail.productId);
        return product ? {
            product,
            quantity: detail.quantity,
            total: detail.totalAmount,
            unitPriceOverride: this.canOverridePrice ? detail.unitPrice : undefined
        } as DraftItem : null;
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

if (!this.validatePaymentState(this.editMetaForm, this.editTotal, this.editPaymentState, 'editar')) {
    return;
}

this.savingEdit = true;
this.saleService.updateSale(this.editingSale.id, this.buildRequest(this.editMetaForm, this.editItems, this.editPaymentState, this.editingSale.customerId ?? null, this.editAutoSurcharge)).subscribe({
    next: (response) => {
        const shouldSuggestWhatsApp = Number(this.editMetaForm.get('idSaleStatus')?.value ?? 1) === 2;
        this.toast.success(shouldSuggestWhatsApp ? 'Venta actualizada. El WhatsApp queda disponible para envio manual.' : 'Venta actualizada');
        if ((response?.changeAmount ?? 0) > 0) {
            this.toast.show(`Vuelto a entregar: $${response.changeAmount!.toFixed(2)}`, 'info');
        }
        const branchId = this.editMetaForm.get('branchId')?.value ?? '';
        this.savingEdit = false;
        this.loadStockForBranch(branchId, false);
        this.cancelEdit();
        this.loadSales();
    },
    error: err => {
        this.savingEdit = false;
        this.handleSaleChargeError(err, 'No se pudo actualizar la venta');
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
        const drawer = drawers.find(d => d.isActive && d.hasOpenSession) ?? null;

        if (!drawer) {
            this.quickPayingSaleId = null;
            this.toast.error('No hay una caja con sesion abierta disponible para cobrar esta venta.');
            return;
        }

        {

                const existingPayments = (sale.payments ?? []).map(payment => ({
                    idPaymentMethod: payment.idPaymentMethod,
                    amount: roundMoney(payment.amount),
                    reference: payment.reference ?? null,
                    cardBankId: payment.cardBankId ?? null,
                    cardCuotas: payment.cardCuotas ?? null,
                    cardSurchargeAmt: payment.cardSurchargeAmt ?? null,
                    transferBankId: payment.transferBankId ?? null,
                    cheque: payment.cheque ?? null
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
                    noDeliverySurchargeTotal: sale.noDeliverySurchargeTotal ?? null,
                    sourceChannel: sale.sourceChannel ?? null,
                    deliveryAddress: sale.deliveryAddress ?? null,
                    payments: pendingAmount > 0
                        ? [
                            ...existingPayments,
                            {
                                idPaymentMethod: SALE_PAYMENT_METHOD_CASH,
                                amount: pendingAmount,
                                reference: null
                            }
                        ]
                        : existingPayments,
                    tradeIns: existingTradeIns,
                    details: sale.details.map(detail => ({
                        productId: detail.productId,
                        quantity: detail.quantity,
                        unitPrice: detail.quantity > 0 ? detail.totalAmount / detail.quantity : detail.unitPrice
                    }))
                }).subscribe({
                    next: () => {
                        this.quickPayingSaleId = null;
                        this.toast.success('Venta marcada como pagada. El WhatsApp queda listo para envio manual.');
                        this.loadSales();
                    },
                    error: err => {
                        this.quickPayingSaleId = null;
                        this.handleSaleChargeError(err, 'No se pudo cobrar la venta');
                    }
                });
        }
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
    if (sale.idSaleStatus !== 1 && sale.idSaleStatus !== 2) {
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
    this.saleService.cancelSale(sale.id).subscribe({
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
    this.generateRemito(sale, true);
    }

exportRemitoTraslado(sale: SaleResponse): void {
    this.generateRemito(sale, false);
    }

private async generateRemito(sale: SaleResponse, incluirImportes: boolean): Promise<void> {
    if (sale.details.length === 0) {
        this.toast.error('La venta no tiene items para exportar.');
        return;
    }

    await this.remitoPdf.generate(
        {
            id: sale.id,
            code: sale.code ?? null,
            createdAt: sale.createdAt,
            customerFullName: sale.customerFullName,
            customerDocument: sale.customerDocument,
            customerTaxId: sale.customerTaxId,
            hasDelivery: sale.hasDelivery,
            totalAmount: sale.totalAmount,
            details: sale.details.map(d => ({
                productBrand: d.productBrand,
                productName: d.productName,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                totalAmount: d.totalAmount
            })),
            tradeIns: (sale.tradeIns ?? []).map(t => ({
                productBrand: '',
                productName: t.productName ?? '',
                quantity: t.quantity,
                amount: t.amount
            }))
        },
        {
            branchName: this.branchName(sale.branchId),
            statusLabel: this.saleStatusLabel(sale),
            paymentSummary: this.salePaymentMethodSummary(sale),
            coveredAmount: this.saleCoveredAmount(sale)
        },
        incluirImportes
    );
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
        // Transport was removed via QUITAR (Cancelled) but assignment ID was cleared from the sale.
        // Show Cancelado so the chip reflects the actual transport history instead of "Pendiente"
        // (which would imply no transport was ever assigned).
        if (sale.transportStatus === 4) {
            return 'Cancelado';
        }
        return 'Pendiente';
    }

    return this.transportStatusLabel(sale.transportStatus, sale.transportStatusName);
}

transportStatusChipClass(sale: SaleResponse): string {
    if (!sale.hasDelivery) {
        return 'chip--transport-na';
    }

    if (!sale.transportAssignmentId) {
        if (sale.transportStatus === 4) {
            return 'chip--transport-cancelled';
        }
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

salePaymentDetailSummary(sale: SaleResponse): string {
    const parts: string[] = [];
    for (const p of (sale.payments ?? []).filter(p => Number(p.amount) > 0)) {
        const name = p.paymentMethodName?.trim() || SALE_PAYMENT_METHODS.find(m => m.id === Number(p.idPaymentMethod))?.label || 'Otros';
        const formatted = '$' + Number(p.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 });
        parts.push(`${name}: ${formatted}`);
    }
    for (const t of (sale.tradeIns ?? []).filter(t => Number(t.amount) > 0)) {
        const formatted = '$' + Number(t.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 });
        parts.push(`Canje: ${formatted}`);
    }
    return parts.length > 0 ? parts.join(' | ') : 'Sin pagos';
}

salePaymentRefs(sale: SaleResponse): string {
    return (sale.payments ?? [])
        .map(p => p.reference?.trim() ?? '')
        .filter(r => r.length > 0)
        .join(' · ');
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
    const today = localDateString();
    this.filterForm.reset({ dateFrom: today, dateTo: '', idSaleStatus: '', sourceChannel: '', transportStatus: '', code: '', phone: '', deliveryAddress: '' });
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
            this.defaultNoDeliverySurcharge = company.defaultNoDeliverySurcharge ?? 0;
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
            const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? null;
            const canViewAllDrawers = this.auth.hasPermission(PermissionCodes.cashDrawerViewAll);
            const target = drawers
                .filter(d => d.isActive && d.hasOpenSession)
                .filter(d => canViewAllDrawers || !assignedId || d.id === assignedId);
            if (isCreate) {
                this.createDrawers = target;
                if (target.length === 1) {
                    this.setCreateCashDrawerId(target[0].id);
                } else if (assignedId && target.some(d => d.id === assignedId)) {
                    this.setCreateCashDrawerId(assignedId);
                }
            } else {
                this.editDrawers = target;
                if (target.length === 1) {
                    this.setEditCashDrawerId(target[0].id);
                } else if (assignedId && target.some(d => d.id === assignedId)) {
                    this.setEditCashDrawerId(assignedId);
                }
            }
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

    const unitPrice = this.branchUnitPrice(product, target);
    if (existing) {
        existing.quantity = nextQuantity;
        existing.total = existing.quantity * unitPrice;
    } else {
        target.unshift({ product, quantity: Math.floor(quantity), total: unitPrice * Math.floor(quantity) });
    }

    return true;
}

    // Precio unitario del carrito: usa el precio efectivo de la sucursal (override) si existe, sino el global.
    private branchUnitPrice(product: ProductResponse, target: DraftItem[]): number {
    const stockMap = target === this.draftItems ? this.createStockByProductId : this.editStockByProductId;
    return stockMap.get(product.id)?.effectivePrice ?? productPublicPrice(product);
}

    get canOverridePrice(): boolean {
        return this.auth.hasPermission(PermissionCodes.salesPriceOverride);
    }

    setDraftItemPrice(item: DraftItem, price: number): void {
        const numeric = parseFloat(price as any);
        item.unitPriceOverride = isNaN(numeric) ? 0 : numeric;
        item.total = item.unitPriceOverride * item.quantity;
    }

    setEditItemPrice(item: DraftItem, price: number): void {
        const numeric = parseFloat(price as any);
        item.unitPriceOverride = isNaN(numeric) ? 0 : numeric;
        item.total = item.unitPriceOverride * item.quantity;
    }

    private buildRequest(form: FormGroup, items: DraftItem[], paymentState: SalePaymentDraftState, customerId: string | null = null, surcharge = 0) {
    const raw = form.getRawValue();
    const canOverride = this.canOverridePrice;
    const rawChannel = raw.sourceChannel;
    return {
        branchId: raw.branchId,
        customerId,
        idSaleStatus: Number(raw.idSaleStatus ?? 1),
        hasDelivery: Boolean(raw.hasDelivery),
        cashDrawerId: raw.cashDrawerId || null,
        payments: normalizeSalePayments(paymentState),
        tradeIns: normalizeSaleTradeIns(paymentState),
        noDeliverySurchargeTotal: surcharge > 0 ? surcharge : null,
        sourceChannel: (rawChannel !== null && rawChannel !== '' && rawChannel !== undefined) ? Number(rawChannel) as SaleSourceChannel : null,
        deliveryAddress: raw.deliveryAddress || null,
        details: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            ...(canOverride && item.unitPriceOverride !== undefined ? { unitPrice: item.unitPriceOverride } : {})
        }))
    };
}

saleChannelLabel(sale: SaleResponse): string {
    return this.saleSourceChannels.find(item => item.value === sale.sourceChannel)?.label ?? '';
}

openChannelPopup(sale: SaleResponse): void {
    this.channelPopupSale = sale;
    this.channelPopupValue = sale.sourceChannel ?? null;
}

closeChannelPopup(): void {
    if (this.savingChannel) return;
    this.channelPopupSale = null;
    this.channelPopupValue = null;
}

selectChannelInPopup(value: SaleSourceChannel | null): void {
    this.channelPopupValue = value;
}

saveChannelPopup(): void {
    const sale = this.channelPopupSale;
    if (!sale || this.savingChannel) return;
    const newChannel = this.channelPopupValue;
    this.savingChannel = true;
    const request: CreateSaleRequest = {
        branchId: sale.branchId,
        customerId: sale.customerId ?? null,
        idSaleStatus: sale.idSaleStatus,
        hasDelivery: sale.hasDelivery,
        cashDrawerId: sale.cashDrawerId ?? null,
        payments: (sale.payments ?? []).map(p => ({
            idPaymentMethod: p.idPaymentMethod,
            amount: p.amount,
            reference: p.reference,
            cardBankId: p.cardBankId ?? null,
            cardCuotas: p.cardCuotas ?? null,
            cardSurchargeAmt: p.cardSurchargeAmt ?? null,
            transferBankId: p.transferBankId ?? null,
            cheque: p.cheque ?? null
        })),
        tradeIns: (sale.tradeIns ?? []).map(t => ({ productId: t.productId, quantity: t.quantity, amount: t.amount })),
        details: sale.details.map(d => ({ productId: d.productId, quantity: d.quantity, unitPrice: d.unitPrice })),
        noDeliverySurchargeTotal: sale.noDeliverySurchargeTotal ?? null,
        deliveryAddress: sale.deliveryAddress ?? null,
        sourceChannel: newChannel
    };
    this.saleService.updateSale(sale.id, request).subscribe({
        next: () => {
            this.sales = this.sales.map(s => s.id === sale.id ? { ...s, sourceChannel: newChannel } : s);
            this.toast.success('Canal de origen actualizado.');
            this.savingChannel = false;
            this.channelPopupSale = null;
            this.channelPopupValue = null;
        },
        error: () => {
            this.toast.error('No se pudo actualizar el canal.');
            this.savingChannel = false;
        }
    });
}

    canSendSaleWhatsApp(sale: SaleResponse): boolean {
    return this.whatsAppEnabled
        && Boolean(this.whatsAppPhoneNumber)
        && sale.idSaleStatus === 2
        && Boolean(sale.customerId);
}

    private validatePaymentState(form: FormGroup, total: number, paymentState: SalePaymentDraftState, mode: 'crear' | 'editar'): boolean {
    const payments = normalizeSalePayments(paymentState);
    const tradeIns = normalizeSaleTradeIns(paymentState);
    const coverage = roundMoney(
        payments.reduce((sum, item) => sum + item.amount, 0)
        + tradeIns.reduce((sum, item) => sum + item.amount, 0)
    );
    const cardSurcharge = roundMoney(paymentState.payments.reduce((sum, p) => sum + (p.cardSurchargeAmt ?? 0), 0));
    const effectiveTotal = roundMoney(total + cardSurcharge);
    const isPaid = Number(form.get('idSaleStatus')?.value ?? 1) === 2;

    if (paymentState.hasTradeIn) {
        const hasIncompleteTradeIn = paymentState.tradeIns
            .some(item =>
                (item.productId && (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0))
                || (!item.productId && (Number(item.amount) > 0 || Number(item.quantity) > 1))
            );

        if (hasIncompleteTradeIn) {
            this.toast.error('Completa producto, cantidad y monto en cada item de canje.');
            return false;
        }
    }

    const missingTransferBank = paymentState.payments.some(
        p => p.idPaymentMethod === 2 && p.amount > 0 && !p.transferBankId
    );
    if (missingTransferBank) {
        this.toast.error('Seleccioná el banco para el pago por transferencia.');
        return false;
    }

    const missingCardBank = paymentState.payments.some(
        p => p.idPaymentMethod === 3 && p.amount > 0 && (!p.cardBankId || !p.cardCuotas)
    );
    if (missingCardBank) {
        this.toast.error('Seleccioná el banco y las cuotas para el pago con tarjeta.');
        return false;
    }

    if (isPaid && coverage < effectiveTotal) {
        this.toast.error('El cobro no cubre el total de la venta.');
        return false;
    }

    if (!isPaid && coverage > effectiveTotal) {
        this.toast.error('Una venta en espera puede ser parcial, pero no superar el total.');
        return false;
    }

    const drawers = form === this.lineForm ? this.createDrawers : this.editDrawers;
    if (hasCashPayment(paymentState) && drawers.length > 0 && !form.get('cashDrawerId')?.value) {
        this.toast.error('Selecciona una caja para registrar el cobro en efectivo.');
        return false;
    }

    return true;
}

    private requiresCashDrawerFor(form: FormGroup, paymentState: SalePaymentDraftState): boolean {
    const drawers = form === this.lineForm ? this.createDrawers : this.editDrawers;
    return drawers.length > 0;
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
    unitPriceOverride?: number;
}

