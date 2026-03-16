import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { CustomerService } from '../../core/services/customer.service';
import { ProductService } from '../../core/services/product.service';
import { BranchService } from '../../core/services/branch.service';
import { CashService } from '../../core/services/cash.service';
import { StockService } from '../../core/services/stock.service';
import { SaleService } from '../../core/services/sale.service';
import { CompanyService } from '../../core/services/company.service';
import { EmployeeService } from '../../core/services/employee.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { ToastService } from '../../shared/services/toast.service';
import { CustomerSearchItem } from '../../core/models/customer.models';
import { ProductResponse, productPublicPrice } from '../../core/models/product.models';
import { BranchResponse } from '../../core/models/branch.models';
import { CashDrawerResponse } from '../../core/models/cash.models';
import { DriverResponse } from '../../core/models/employee.models';
import { VehicleResponse } from '../../core/models/vehicle.models';
import { BranchProductStockResponse } from '../../core/models/stock.models';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SalePaymentInlineComponent } from '../../shared/components/sale-payment-inline/sale-payment-inline.component';
import {
  SalePaymentDraftState,
  createEmptySalePaymentDraftState,
  hasCashPayment,
  normalizeSalePayments,
  normalizeSaleTradeIns,
  paymentMethodSummary,
  roundMoney,
  salePaymentCoverage
} from '../../core/models/sale-payment.models';

@Component({
  selector: 'app-sales-full',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent, SalePaymentInlineComponent],
  templateUrl: './sales-full.component.html',
  styleUrls: ['./sales-full.component.css']
})
export class SalesFullComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;
  step = 1;
  saving = false;
  customerMode: 'existing' | 'new' = 'existing';
  searchResults: CustomerSearchItem[] = [];
  selectedExistingCustomer: CustomerSearchItem | null = null;
  branches: BranchResponse[] = [];
  products: ProductResponse[] = [];
  cashDrawers: CashDrawerResponse[] = [];
  stockByProductId = new Map<string, BranchProductStockResponse>();
  drivers: DriverResponse[] = [];
  vehicles: VehicleResponse[] = [];
  draftItems: DraftItem[] = [];
  productQuery = '';
  productModalOpen = false;
  selectedProductIds = new Set<string>();
  selectionQuantityByProductId = new Map<string, number>();
  paymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
  whatsAppEnabled = false;
  readonly documentTypes = [{ value: 1, label: 'DNI' }, { value: 2, label: 'Pasaporte' }, { value: 3, label: 'LE' }, { value: 4, label: 'LC' }, { value: 5, label: 'Otro' }];
  readonly searchForm = this.fb.group({ query: [''] });
  readonly customerForm = this.fb.group({ firstName: ['', Validators.required], lastName: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phone: ['', Validators.required], documentType: [1, Validators.required], documentNumber: ['', Validators.required], taxId: [''] });
  readonly addressForm = this.fb.group({ street: ['', Validators.required], streetNumber: ['', Validators.required], postalCode: ['', Validators.required], city: ['', Validators.required], stateOrProvince: ['', Validators.required], country: ['Argentina', Validators.required], floor: [''], apartment: [''], reference: [''] });
  readonly saleForm = this.fb.group({ branchId: ['', Validators.required], idSaleStatus: [1, Validators.required], hasDelivery: [false], cashDrawerId: [''] });
  readonly itemForm = this.fb.group({ productId: ['', Validators.required], quantity: [1, [Validators.required, Validators.min(1)]] });
  readonly transportForm = this.fb.group({ driverEmployeeId: ['', Validators.required], vehicleId: ['', Validators.required], notes: [''] });

  constructor(private readonly fb: FormBuilder, private readonly customerService: CustomerService, private readonly productService: ProductService, private readonly branchService: BranchService, private readonly cashService: CashService, private readonly stockService: StockService, private readonly saleService: SaleService, private readonly companyService: CompanyService, private readonly employeeService: EmployeeService, private readonly vehicleService: VehicleService, private readonly toast: ToastService, private readonly router: Router, public readonly auth: AuthService) { }

  ngOnInit(): void {
    this.productService.listProducts().subscribe({ next: products => this.products = [...products].sort((left, right) => this.productLabel(left).localeCompare(this.productLabel(right))) });
    this.branchService.listBranches().subscribe({
      next: branches => {
        this.branches = branches;
        if (!this.saleForm.get('branchId')?.value && branches.length > 0) {
          this.saleForm.patchValue({ branchId: branches[0].id });
          this.handleBranchChange();
        }
      }
    });
    this.employeeService.listDrivers().subscribe({ next: drivers => this.drivers = drivers });
    this.vehicleService.listVehicles().subscribe({ next: vehicles => this.vehicles = vehicles });
    this.companyService.getCurrentCompany().subscribe({
      next: company => {
        this.whatsAppEnabled = Boolean(company.isWhatsAppEnabled ?? company.whatsAppEnabled);
      }
    });
  }

  get requiresDelivery(): boolean { return Boolean(this.saleForm.get('hasDelivery')?.value); }
  get stepLabels(): string[] { return this.requiresDelivery ? ['Cliente', 'Datos', 'Domicilio', 'Venta', 'Envio', 'Confirmacion'] : ['Cliente', 'Datos', 'Domicilio', 'Venta', 'Confirmacion']; }
  get totalSteps(): number { return this.stepLabels.length; }
  get isTransportStep(): boolean { return this.requiresDelivery && this.step === 5; }
  get isConfirmationStep(): boolean { return this.step === this.confirmationStepNumber; }
  get confirmationStepNumber(): number { return this.requiresDelivery ? 6 : 5; }
  get isPaid(): boolean { return Number(this.saleForm.get('idSaleStatus')?.value ?? 1) === 2; }
  get paymentCoverage(): number { return salePaymentCoverage(this.paymentState); }
  get paymentRemaining(): number { return roundMoney(this.total - this.paymentCoverage); }
  get requiresCashDrawer(): boolean { return this.isPaid && hasCashPayment(this.paymentState); }
  get activeDrivers(): DriverResponse[] { return this.drivers.filter(driver => driver.isActive && !driver.isLicenseExpired); }
  get activeVehicles(): VehicleResponse[] { return this.vehicles.filter(vehicle => vehicle.isActive); }
  get total(): number { return this.draftItems.reduce((sum, item) => sum + item.total, 0); }
  get productSuggestions(): ProductResponse[] { return this.filterProducts(this.productQuery); }
  get selectedProductsCount(): number { return this.selectedProductIds.size; }
  availableForProduct(productId: string): number {
    const base = this.stockByProductId.get(productId)?.availableQuantity ?? 0;
    const current = this.draftItems.find(item => item.product.id === productId)?.quantity ?? 0;
    return Math.max(base - current, 0);
  }
  get summaryCustomerName(): string { const full = `${this.customerForm.get('firstName')?.value || ''} ${this.customerForm.get('lastName')?.value || ''}`.trim(); return full || this.selectedExistingCustomer?.fullName || this.selectedExistingCustomer?.name || '-'; }
  get summaryDocument(): string { const label = this.documentTypes.find(item => item.value === Number(this.customerForm.get('documentType')?.value))?.label; const number = this.customerForm.get('documentNumber')?.value || ''; return number ? `${label || 'Documento'} ${number}` : `${this.selectedExistingCustomer?.documentTypeName || 'Documento'} ${this.selectedExistingCustomer?.documentNumber || '-'}`; }
  get summaryEmail(): string { return this.customerForm.get('email')?.value || this.selectedExistingCustomer?.email || '-'; }
  get summaryAddressLine(): string { const line = `${this.addressForm.get('street')?.value || ''} ${this.addressForm.get('streetNumber')?.value || ''}`.trim(); return line || (this.customerMode === 'existing' ? 'Cliente existente' : '-'); }
  get summaryAddressLocation(): string { const value = [this.addressForm.get('city')?.value || '', this.addressForm.get('stateOrProvince')?.value || '', this.addressForm.get('country')?.value || ''].filter(Boolean).join(', '); return value || (this.customerMode === 'existing' ? 'Usara el domicilio ya registrado' : '-'); }
  get selectedDriverName(): string { return this.activeDrivers.find(driver => driver.employeeId === this.transportForm.get('driverEmployeeId')?.value)?.fullName || 'Sin conductor'; }
  get selectedVehicleName(): string { const vehicle = this.activeVehicles.find(item => item.id === this.transportForm.get('vehicleId')?.value); return vehicle ? `${vehicle.plate} / ${vehicle.model}` : 'Sin vehiculo'; }
  get selectedBranchName(): string { return this.branches.find(branch => branch.id === this.saleForm.get('branchId')?.value)?.name || 'Sin sucursal'; }
  get selectedDrawerName(): string { return this.requiresCashDrawer ? this.cashDrawers.find(drawer => drawer.id === this.saleForm.get('cashDrawerId')?.value)?.name || 'Caja pendiente' : 'Sin cobro en caja'; }
  get paymentMethodPreview(): string { return paymentMethodSummary(normalizeSalePayments(this.paymentState), normalizeSaleTradeIns(this.paymentState)); }

  setCustomerMode(mode: 'existing' | 'new'): void { this.customerMode = mode; if (mode === 'new') { this.selectedExistingCustomer = null; } }
  searchCustomers(): void {
    this.customerService.searchCustomers(this.searchForm.get('query')?.value || '').subscribe({
      next: customers => this.searchResults = customers,
      error: err => this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudo buscar clientes'))
    });
  }
  selectExistingCustomer(customer: CustomerSearchItem): void {
    this.selectedExistingCustomer = customer;
    this.customerService.getCustomerById(customer.id).subscribe({
      next: fullCustomer => {
        this.customerForm.patchValue({
          firstName: fullCustomer.firstName || '',
          lastName: fullCustomer.lastName || '',
          email: fullCustomer.email || '',
          phone: fullCustomer.phone || '',
          documentType: fullCustomer.documentType ?? 1,
          documentNumber: fullCustomer.documentNumber || '',
          taxId: fullCustomer.taxId || ''
        });
        this.addressForm.patchValue({
          street: fullCustomer.address?.street || '',
          streetNumber: fullCustomer.address?.streetNumber || '',
          postalCode: fullCustomer.address?.postalCode || '',
          city: fullCustomer.address?.city || '',
          stateOrProvince: fullCustomer.address?.stateOrProvince || '',
          country: fullCustomer.address?.country || 'Argentina',
          floor: fullCustomer.address?.floor || '',
          apartment: fullCustomer.address?.apartment || '',
          reference: fullCustomer.address?.reference || ''
        });
      },
      error: err => {
        this.selectedExistingCustomer = null;
        this.resetCustomerForms();
        this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudo cargar el cliente seleccionado'));
      }
    });
  }
  handleBranchChange(): void {
    const branchId = this.saleForm.get('branchId')?.value || '';
    this.saleForm.patchValue({ cashDrawerId: '' });
    this.stockByProductId.clear();
    this.selectedProductIds.clear();
    this.selectionQuantityByProductId.clear();

    if (!branchId) {
      this.cashDrawers = [];
      return;
    }

    this.cashService.listCashDrawers(branchId).subscribe({
      next: drawers => {
        const activeDrawers = drawers.filter(drawer => drawer.isActive);

        if (activeDrawers.length === 0) {
          this.cashDrawers = [];
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
            this.cashDrawers = availableDrawers.filter((drawer): drawer is CashDrawerResponse => drawer !== null);
          },
          error: () => {
            this.cashDrawers = [];
          }
        });
      },
      error: () => {
        this.cashDrawers = [];
      }
    });

    this.stockService.listBranchStock(branchId).subscribe({
      next: items => {
        for (const item of items) {
          this.stockByProductId.set(item.productId, item);
        }
      },
      error: () => this.stockByProductId.clear()
    });
  }
  handleDeliveryToggle(): void { if (this.requiresDelivery) { return; } this.transportForm.reset({ driverEmployeeId: '', vehicleId: '', notes: '' }); if (this.step === 5) { this.step = 4; } if (this.step > this.confirmationStepNumber) { this.step = this.confirmationStepNumber; } }
  openProductModal(): void { this.productModalOpen = true; }
  closeProductModal(): void { this.productModalOpen = false; }
  handleProductInput(query: string): void { this.productQuery = query; }
  isProductSelected(productId: string): boolean { return this.selectedProductIds.has(productId); }
  selectionQuantity(productId: string): number { return this.selectionQuantityByProductId.get(productId) ?? 1; }
  setSelectionQuantity(productId: string, rawValue: string): void { const parsed = Number(rawValue); const max = Math.max(1, this.availableForProduct(productId)); this.selectionQuantityByProductId.set(productId, Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : 1); }
  toggleProductSelection(product: ProductResponse, checked: boolean): void {
    if (checked && this.availableForProduct(product.id) <= 0) { this.toast.error(`Sin stock disponible para ${product.brand} / ${product.name}.`); return; }
    if (checked) { this.selectedProductIds.add(product.id); if (!this.selectionQuantityByProductId.has(product.id)) { this.selectionQuantityByProductId.set(product.id, 1); } return; }
    this.selectedProductIds.delete(product.id);
    this.selectionQuantityByProductId.delete(product.id);
  }
  addSelectedItems(): void {
    if (this.selectedProductIds.size === 0) { return; }
    let added = 0;
    for (const productId of [...this.selectedProductIds]) {
      const product = this.products.find(item => item.id === productId);
      if (!product) { continue; }
      const quantity = this.selectionQuantity(product.id);
      const maxAllowed = this.stockByProductId.get(product.id)?.availableQuantity ?? 0;
      if (this.upsertDraftItem(product, quantity, maxAllowed)) { added += 1; }
    }
    if (added > 0) { this.selectedProductIds.clear(); this.selectionQuantityByProductId.clear(); this.productModalOpen = false; }
  }
  get canOverridePrice(): boolean { return this.auth.hasPermission(PermissionCodes.salesPriceOverride); }
  setDraftItemPrice(item: DraftItem, price: number): void { item.unitPriceOverride = price; item.total = price * item.quantity; }
  removeItem(productId: string): void { this.draftItems = this.draftItems.filter(item => item.product.id !== productId); }
  previousStep(): void { this.step = Math.max(1, this.step - 1); }
  canJumpToStep(targetStep: number): boolean { return targetStep <= this.step && targetStep <= this.totalSteps; }
  jumpToStep(targetStep: number): void { if (this.canJumpToStep(targetStep)) { this.step = targetStep; } }
  jumpToSummaryStep(section: 'customer' | 'address' | 'sale' | 'transport'): void { if (section === 'customer') { this.step = this.customerMode === 'existing' ? 1 : 2; return; } if (section === 'address') { this.step = this.customerMode === 'existing' ? 1 : 3; return; } if (section === 'transport' && this.requiresDelivery) { this.step = 5; return; } this.step = 4; }
  nextStep(): void { if (!this.validateCurrentStep()) { return; } this.step = Math.min(this.totalSteps, this.step + 1); }
  setCashDrawerId(value: string | null): void { this.saleForm.patchValue({ cashDrawerId: value ?? '' }); }

  submit(): void {
    if (!this.validateCurrentStep()) { return; }
    this.saving = true;
    if (this.customerMode === 'existing') { this.updateExistingCustomerAndCreateSale(); return; }
    this.customerService.createCustomer({ firstName: String(this.customerForm.get('firstName')?.value || ''), lastName: String(this.customerForm.get('lastName')?.value || ''), email: String(this.customerForm.get('email')?.value || ''), phone: String(this.customerForm.get('phone')?.value || ''), documentType: Number(this.customerForm.get('documentType')?.value), documentNumber: String(this.customerForm.get('documentNumber')?.value || ''), taxId: this.nullIfEmpty(this.customerForm.get('taxId')?.value), address: { street: String(this.addressForm.get('street')?.value || ''), streetNumber: String(this.addressForm.get('streetNumber')?.value || ''), postalCode: String(this.addressForm.get('postalCode')?.value || ''), city: String(this.addressForm.get('city')?.value || ''), stateOrProvince: String(this.addressForm.get('stateOrProvince')?.value || ''), country: String(this.addressForm.get('country')?.value || ''), floor: this.nullIfEmpty(this.addressForm.get('floor')?.value), apartment: this.nullIfEmpty(this.addressForm.get('apartment')?.value), reference: this.nullIfEmpty(this.addressForm.get('reference')?.value) } }).subscribe({ next: customer => this.createSale(customer.id), error: err => { this.saving = false; this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el cliente'); } });
  }

  private createSale(customerId: string | null): void {
    const request = this.buildSaleRequest(customerId);

    if (!request) {
      this.saving = false;
      return;
    }

    this.saleService.createSale(request).subscribe({
      next: sale => {
        if (!this.requiresDelivery) { this.finish(); return; }
        const transport = this.transportForm.getRawValue();
        this.saleService.createTransport(sale.id, { driverEmployeeId: String(transport.driverEmployeeId || ''), vehicleId: String(transport.vehicleId || ''), notes: this.nullIfEmpty(transport.notes) }).subscribe({ next: () => this.finish(), error: err => { this.saving = false; this.toast.error(err?.error?.detail || err?.error?.message || 'La venta se creo, pero no se pudo asignar el envio'); } });
      },
      error: err => { this.saving = false; this.toast.error(this.resolveSaleCustomerErrorMessage(err, customerId, 'No se pudo crear la venta')); }
    });
  }

  private updateExistingCustomerAndCreateSale(): void {
    if (!this.selectedExistingCustomer) {
      this.saving = false;
      this.toast.error('Selecciona un cliente existente.');
      return;
    }

    this.customerService.updateCustomer({
      id: this.selectedExistingCustomer.id,
      firstName: String(this.customerForm.get('firstName')?.value || ''),
      lastName: String(this.customerForm.get('lastName')?.value || ''),
      email: String(this.customerForm.get('email')?.value || ''),
      phone: String(this.customerForm.get('phone')?.value || ''),
      documentType: Number(this.customerForm.get('documentType')?.value),
      documentNumber: String(this.customerForm.get('documentNumber')?.value || ''),
      taxId: this.nullIfEmpty(this.customerForm.get('taxId')?.value),
      address: {
        street: String(this.addressForm.get('street')?.value || ''),
        streetNumber: String(this.addressForm.get('streetNumber')?.value || ''),
        postalCode: String(this.addressForm.get('postalCode')?.value || ''),
        city: String(this.addressForm.get('city')?.value || ''),
        stateOrProvince: String(this.addressForm.get('stateOrProvince')?.value || ''),
        country: String(this.addressForm.get('country')?.value || ''),
        floor: this.nullIfEmpty(this.addressForm.get('floor')?.value),
        apartment: this.nullIfEmpty(this.addressForm.get('apartment')?.value),
        reference: this.nullIfEmpty(this.addressForm.get('reference')?.value)
      }
    }).subscribe({
      next: updatedCustomer => this.createSale(updatedCustomer.id),
      error: err => {
        this.saving = false;
        this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudo actualizar el cliente'));
      }
    });
  }

  private finish(): void {
    this.saving = false;
    const shouldSuggestWhatsApp = this.isPaid && this.whatsAppEnabled && this.customerHasPhone();
    this.toast.success(shouldSuggestWhatsApp ? 'Venta completa creada. El WhatsApp queda disponible para envio manual en Ventas.' : 'Venta completa creada');
    this.router.navigate(['/sales']);
  }

  private validateCurrentStep(): boolean {
    if (this.step === 1 && this.customerMode === 'existing' && !this.selectedExistingCustomer) { this.toast.error('Selecciona un cliente o cambia a crear nuevo.'); return false; }
    if (this.step === 2 && this.customerForm.invalid) { this.customerForm.markAllAsTouched(); this.toast.error('Completa los datos del cliente.'); return false; }
    if (this.step === 3 && this.addressForm.invalid) { this.addressForm.markAllAsTouched(); this.toast.error('Completa el domicilio.'); return false; }
    if (this.step === 4) {
      if (!this.saleForm.get('branchId')?.value) {
        this.saleForm.markAllAsTouched();
        this.toast.error('Selecciona una sucursal.');
        return false;
      }
      if (this.draftItems.length === 0) {
        this.toast.error('Agrega al menos un item para continuar.');
        return false;
      }
      if (!this.validatePaymentState()) { return false; }
    }
    if (this.isTransportStep && this.transportForm.invalid) { this.transportForm.markAllAsTouched(); this.toast.error('Selecciona conductor y vehiculo para el envio.'); return false; }
    return true;
  }

  private buildSaleRequest(customerId: string | null) {
    const raw = this.saleForm.getRawValue();
    const payments = normalizeSalePayments(this.paymentState);
    const tradeIns = normalizeSaleTradeIns(this.paymentState);

    return {
      branchId: String(raw.branchId || ''),
      customerId,
      idSaleStatus: Number(raw.idSaleStatus ?? 1),
      hasDelivery: Boolean(raw.hasDelivery),
      cashDrawerId: this.requiresCashDrawer ? raw.cashDrawerId || null : null,
      payments,
      tradeIns,
      details: this.draftItems.map(item => ({ productId: item.product.id, quantity: item.quantity, ...(this.canOverridePrice && item.unitPriceOverride !== undefined ? { unitPrice: item.unitPriceOverride } : {}) }))
    };
  }

  private validatePaymentState(): boolean {
    const payments = normalizeSalePayments(this.paymentState);
    const tradeIns = normalizeSaleTradeIns(this.paymentState);
    const coverage = roundMoney(
      payments.reduce((sum, item) => sum + item.amount, 0)
      + tradeIns.reduce((sum, item) => sum + item.amount, 0)
    );
    const total = roundMoney(this.total);

    if (this.paymentState.hasTradeIn) {
      const hasIncompleteTradeIn = this.paymentState.tradeIns.some(item =>
        (item.productId && (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0 || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0))
        || (!item.productId && (Number(item.amount) > 0 || Number(item.quantity) > 1))
      );

      if (hasIncompleteTradeIn) {
        this.toast.error('Completa producto, cantidad y monto en cada canje cargado.');
        return false;
      }
    }

    if (this.isPaid && coverage !== total) {
      this.toast.error('Una venta pagada debe quedar cancelada exactamente con payments + tradeIns.');
      return false;
    }

    if (!this.isPaid && coverage > total) {
      this.toast.error('Una venta en espera puede tener cobro parcial, pero nunca superar el total.');
      return false;
    }

    if (this.requiresCashDrawer && !this.saleForm.get('cashDrawerId')?.value) {
      this.toast.error('Selecciona una caja con sesion abierta si hay efectivo en una venta pagada.');
      return false;
    }

    return true;
  }

  private upsertDraftItem(product: ProductResponse, quantity: number, maxAllowed: number): boolean {
    if (!Number.isFinite(quantity) || quantity <= 0) { return false; }
    const existing = this.draftItems.find(item => item.product.id === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + Math.floor(quantity);
    if (nextQuantity > maxAllowed) { this.toast.error(`No hay stock suficiente para ${product.brand} / ${product.name}. Disponible: ${Math.max(maxAllowed, 0)}.`); return false; }
    if (existing) {
      existing.quantity = nextQuantity;
      existing.total = existing.quantity * productPublicPrice(product);
    } else {
      this.draftItems.unshift({ product, quantity: Math.floor(quantity), total: productPublicPrice(product) * Math.floor(quantity) });
    }
    return true;
  }

  private resetCustomerForms(): void {
    this.customerForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      documentType: 1,
      documentNumber: '',
      taxId: ''
    });
    this.addressForm.reset({
      street: '',
      streetNumber: '',
      postalCode: '',
      city: '',
      stateOrProvince: '',
      country: 'Argentina',
      floor: '',
      apartment: '',
      reference: ''
    });
  }

  private isTenantScopeError(err: unknown): boolean {
    const status = (err as HttpErrorResponse | undefined)?.status;
    return status === 403 || status === 404;
  }

  private resolveCustomerErrorMessage(err: unknown, fallback: string): string {
    if (this.isTenantScopeError(err)) {
      return 'El cliente no esta disponible para la empresa actual.';
    }

    return (err as any)?.error?.detail || (err as any)?.error?.message || fallback;
  }

  private resolveSaleCustomerErrorMessage(err: unknown, customerId: string | null, fallback: string): string {
    if (customerId && this.isTenantScopeError(err)) {
      return 'El cliente seleccionado no pertenece a la empresa actual.';
    }

    return (err as any)?.error?.detail || (err as any)?.error?.message || fallback;
  }

  private customerHasPhone(): boolean {
    return Boolean(String(this.customerForm.get('phone')?.value || this.selectedExistingCustomer?.phone || '').trim());
  }

  private nullIfEmpty(value: string | null | undefined): string | null { return value && value.trim().length > 0 ? value.trim() : null; }
  private filterProducts(query: string): ProductResponse[] { const normalized = query.trim().toLowerCase(); return this.products.filter(product => !normalized || `${product.code} ${product.sku} ${product.brand} ${product.name} ${product.description || ''} ${product.id}`.toLowerCase().includes(normalized)).slice(0, 20); }
  private productLabel(product: ProductResponse): string { return `${product.code} · ${product.brand} / ${product.name}`; }
}

interface DraftItem { product: ProductResponse; quantity: number; total: number; unitPriceOverride?: number; }
