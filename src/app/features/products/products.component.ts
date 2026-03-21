import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { ProductService } from '../../core/services/product.service';
import { ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../core/models/product.models';
import { ToastService } from '../../shared/services/toast.service';
import { BranchService } from '../../core/services/branch.service';
import { BranchResponse } from '../../core/models/branch.models';
import { StockService } from '../../core/services/stock.service';
import { BranchProductStockResponse, StockMovementResponse } from '../../core/models/stock.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

type ProductModalMode = 'detail' | 'edit' | 'delete' | 'stock';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent, OnboardingBannerComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  createPriceMode: 'public' | 'margin' = 'public';
  editPriceMode: 'public' | 'margin' = 'public';
  createForm: FormGroup;
  editForm: FormGroup;
  stockForm: FormGroup;
  bulkEditForms: Record<string, FormGroup> = {};
  bulkEditSnapshots: Record<string, ReturnType<ProductsComponent['toProductRequest']>> = {};
  modifiedBulkProductIds = new Set<string>();
  products: ProductResponse[] = [];
  branches: BranchResponse[] = [];
  readonly pageSizeOptions = [10, 25, 50];
  loading = false;
  creating = false;
  updating = false;
  deleting = false;
  stockSaving = false;
  stockLoading = false;
  bulkEditMode = false;
  bulkEditSaving = false;
  showCreatePanel = true;
  showListPanel = true;
  currentPage = 1;
  pageSize = 10;
  totalProducts = 0;
  totalPages = 1;
  selectedProduct: ProductResponse | null = null;
  modalMode: ProductModalMode = 'edit';
  onboardingStatus: OnboardingStatusResponse | null = null;
  selectedStockBranchId = '';
  selectedBranchStock: BranchProductStockResponse | null = null;
  stockMovements: StockMovementResponse[] = [];
  compactMode = true;
  sortColumn: string | null = null;
  sortDir: 'asc' | 'desc' = 'desc';

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private branchService: BranchService,
    private stockService: StockService,
    private toast: ToastService,
    private onboardingService: OnboardingService,
    private router: Router,
    public auth: AuthService
  ) {
    this.createForm = this.buildForm();
    this.editForm = this.buildForm();
    this.stockForm = this.fb.group({
      type: [1, Validators.required],
      quantity: [1, Validators.required],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.refreshOnboarding();
    this.loadBranches();
    this.loadProducts();
  }

  get showProductOnboarding(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Product';
  }

  get showStockOnboarding(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Stock';
  }

  get isOnboardingFocusLocked(): boolean {
    const step = this.currentOnboardingStep;
    return !!step && !this.onboardingService.isStepAccepted(step);
  }

  get canViewCostPrice(): boolean {
    return this.auth.hasRole('owner') || this.auth.hasRole('admin');
  }

  get showHiddenColumns(): boolean {
    return !this.compactMode || this.bulkEditMode;
  }

  isInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  get pageStart(): number {
    if (this.totalProducts === 0) {
      return 0;
    }

    return ((this.currentPage - 1) * this.pageSize) + 1;
  }

  get pageEnd(): number {
    if (this.totalProducts === 0) {
      return 0;
    }

    return Math.min(this.currentPage * this.pageSize, this.totalProducts);
  }

  get modifiedProductsCount(): number {
    return this.modifiedBulkProductIds.size;
  }

  get invalidBulkRowsCount(): number {
    return this.products.filter(product => {
      const form = this.bulkEditForms[product.id];
      return !!form && this.modifiedBulkProductIds.has(product.id) && form.invalid;
    }).length;
  }

  visiblePrice(product: ProductResponse): number {
    return productPublicPrice(product);
  }

  productAllowsManualSaleValue(product: ProductResponse): boolean {
    return productAllowsManualSaleValue(product);
  }

  publicPricePreview(form: FormGroup): number {
    return Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
  }

  costPricePreview(form: FormGroup): number {
    return Number(form.get('costPrice')?.value ?? 0);
  }

  marginPreview(form: FormGroup): number {
    const publicPrice = this.publicPricePreview(form);
    const costPrice = this.costPricePreview(form);
    if (costPrice <= 0 || publicPrice < 0) {
      return 0;
    }

    return ((publicPrice - costPrice) / costPrice) * 100;
  }

  setCreatePriceMode(mode: 'public' | 'margin'): void {
    if (this.createForm.get('allowsManualSaleValue')?.value) {
      this.createPriceMode = 'public';
      this.syncPriceMode(this.createForm, this.createPriceMode);
      return;
    }
    this.createPriceMode = this.canViewCostPrice ? mode : 'public';
    this.syncPriceMode(this.createForm, this.createPriceMode);
  }

  setEditPriceMode(mode: 'public' | 'margin'): void {
    if (this.editForm.get('allowsManualSaleValue')?.value) {
      this.editPriceMode = 'public';
      this.syncPriceMode(this.editForm, this.editPriceMode);
      return;
    }
    this.editPriceMode = this.canViewCostPrice ? mode : 'public';
    this.syncPriceMode(this.editForm, this.editPriceMode);
  }

  toggleManualSaleValue(form: FormGroup, mode: 'public' | 'margin', checked: boolean, context: 'create' | 'edit' | 'bulk'): void {
    form.patchValue({ allowsManualSaleValue: checked }, { emitEvent: false });
    this.updatePriceValidators(form);

    if (checked) {
      form.patchValue({ publicPrice: 0, price: 0, marginPercent: 0 }, { emitEvent: false });

      if (context === 'create') {
        this.createPriceMode = 'public';
      }

      if (context === 'edit') {
        this.editPriceMode = 'public';
      }
    } else {
      const fallbackPrice = Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
      form.patchValue({ publicPrice: fallbackPrice > 0 ? fallbackPrice : 0.01, price: fallbackPrice > 0 ? fallbackPrice : 0.01 }, { emitEvent: false });
      this.syncPriceMode(form, mode);
    }

    form.get('publicPrice')?.markAsTouched();
    form.get('publicPrice')?.updateValueAndValidity({ emitEvent: false });
  }

  syncPriceFromMargin(form: FormGroup, mode: 'public' | 'margin'): void {
    if (mode !== 'margin') {
      return;
    }

    const costPrice = Number(form.get('costPrice')?.value ?? 0);
    const marginPercent = Number(form.get('marginPercent')?.value ?? 0);
    const publicPrice = costPrice > 0 ? costPrice * (1 + (marginPercent / 100)) : 0;
    form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating = true;
    this.productService.createProduct(this.toProductRequest(this.createForm)).subscribe({
      next: (product) => {
        this.createForm.reset({ code: '', sku: '', brand: '', name: '', description: '', publicPrice: 0, price: 0, costPrice: 0, unitPrice: null, marginPercent: 0, noDeliverySurcharge: null });
        this.createForm.patchValue({ allowsManualSaleValue: false }, { emitEvent: false });
        this.updatePriceValidators(this.createForm);
        this.createPriceMode = 'public';
        this.toast.success(`Producto "${product.name}" creado correctamente`);
        this.creating = false;
        this.currentPage = 1;
        this.loadProducts();
        this.refreshOnboarding(true);
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Error al crear el producto');
        this.creating = false;
      }
    });
  }

  openEditor(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'edit';
    this.openModal(product);
  }

  openDelete(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'delete';
    this.openModal(product);
  }

  openStock(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'stock';
    this.selectedProduct = product;
    this.stockForm.reset({ type: 1, quantity: 1, description: '' });
    this.stockMovements = [];
    this.selectedBranchStock = null;
    this.selectedStockBranchId = '';
  }

  openDetailModal(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'detail';
    this.selectedProduct = product;
  }

  toggleCompactMode(): void {
    this.compactMode = !this.compactMode;
  }

  closeModal(): void {
    if (this.updating || this.deleting || this.stockSaving) {
      return;
    }
    this.selectedProduct = null;
    this.selectedStockBranchId = '';
    this.selectedBranchStock = null;
    this.stockMovements = [];
  }

  submitModal(): void {
    if (this.modalMode === 'detail') {
      return;
    }
    if (this.modalMode === 'delete') {
      this.remove();
      return;
    }
    this.update();
  }

  changeStockBranch(branchId: string): void {
    this.selectedStockBranchId = branchId;
    this.selectedBranchStock = null;
    this.stockMovements = [];

    if (!this.selectedProduct || !branchId) {
      return;
    }

    this.stockLoading = true;
    this.stockService.getBranchProductStock(branchId, this.selectedProduct.id).subscribe({
      next: stock => {
        this.selectedBranchStock = stock;
        this.stockLoading = false;
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el stock de la sucursal');
        this.stockLoading = false;
      }
    });

    this.stockService.listStockMovements(branchId, this.selectedProduct.id).subscribe({
      next: movements => this.stockMovements = movements,
      error: () => this.stockMovements = []
    });
  }

  submitStock(): void {
    if (!this.selectedProduct || !this.selectedStockBranchId) {
      this.toast.error('Selecciona una sucursal para ajustar stock.');
      return;
    }

    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      return;
    }

    const raw = this.stockForm.getRawValue();
    this.stockSaving = true;
    this.stockService.adjustStock({
      branchId: this.selectedStockBranchId,
      productId: this.selectedProduct.id,
      quantity: Number(raw.quantity ?? 0),
      type: Number(raw.type ?? 1),
      description: raw.description || null
    }).subscribe({
      next: stock => {
        this.selectedBranchStock = stock;
        this.stockSaving = false;
        this.stockForm.patchValue({ quantity: 1, description: '' });
        this.toast.success('Stock actualizado');
        this.changeStockBranch(this.selectedStockBranchId);
        this.loadProducts();
        this.refreshOnboarding(true);
      },
      error: err => {
        this.stockSaving = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el stock');
      }
    });
  }

  update(): void {
    if (!this.selectedProduct) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.updating = true;
    this.productService.updateProduct(this.selectedProduct.id, this.toProductRequest(this.editForm)).subscribe({
      next: (updated) => {
        this.products = this.products.map(product => product.id === updated.id ? updated : product);
        this.toast.success(`Producto "${updated.name}" actualizado`);
        this.updating = false;
        this.selectedProduct = null;
      },
      error: (err) => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el producto');
        this.updating = false;
      }
    });
  }

  remove(): void {
    if (!this.selectedProduct) {
      return;
    }

    this.deleting = true;
    this.productService.deleteProduct(this.selectedProduct.id).subscribe({
      next: () => {
        this.toast.success(`Producto "${this.selectedProduct?.name}" eliminado`);
        this.deleting = false;
        this.selectedProduct = null;
        this.loadProducts();
      },
      error: (err) => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo eliminar el producto');
        this.deleting = false;
      }
    });
  }

  trackByProduct(_: number, product: ProductResponse): string {
    return product.id;
  }

  toggleCreatePanel(): void {
    this.showCreatePanel = !this.showCreatePanel;
  }

  toggleListPanel(): void {
    if (this.showListPanel && !this.canLeaveBulkEdit()) {
      return;
    }
    this.showListPanel = !this.showListPanel;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    if (!this.canLeaveBulkEdit()) {
      return;
    }

    this.currentPage = page;
    this.loadProducts();
  }

  changePageSize(rawPageSize: string): void {
    const parsedPageSize = Number(rawPageSize);

    if (!Number.isFinite(parsedPageSize) || parsedPageSize <= 0 || parsedPageSize === this.pageSize) {
      return;
    }

    if (!this.canLeaveBulkEdit()) {
      return;
    }

    this.pageSize = parsedPageSize;
    this.currentPage = 1;
    this.loadProducts();
  }

  enterBulkEditMode(): void {
    this.bulkEditMode = true;
    this.bulkEditSaving = false;
    this.bulkEditForms = {};
    this.bulkEditSnapshots = {};
    this.modifiedBulkProductIds = new Set<string>();

    for (const product of this.products) {
      const form = this.buildForm();
      form.reset(this.bulkProductFormValue(product));
      this.updatePriceValidators(form);
      this.bulkEditForms[product.id] = form;
      this.bulkEditSnapshots[product.id] = this.toProductRequest(form);
      form.valueChanges.subscribe(() => this.refreshBulkProductState(product.id));
    }
  }

  cancelBulkEdit(force = false): void {
    if (!force && this.hasPendingBulkChanges() && !window.confirm('Hay cambios sin guardar en la grilla. Si continuas, se perderan.')) {
      return;
    }

    this.bulkEditMode = false;
    this.bulkEditSaving = false;
    this.bulkEditForms = {};
    this.bulkEditSnapshots = {};
    this.modifiedBulkProductIds = new Set<string>();
  }

  saveBulkChanges(): void {
    if (!this.bulkEditMode || this.bulkEditSaving) {
      return;
    }

    const modifiedProducts = this.products.filter(product => this.modifiedBulkProductIds.has(product.id));

    if (modifiedProducts.length === 0) {
      this.toast.error('No hay cambios para guardar.');
      return;
    }

    const invalidForms = modifiedProducts
      .map(product => this.bulkEditForms[product.id])
      .filter((form): form is FormGroup => !!form && form.invalid);

    if (invalidForms.length > 0) {
      invalidForms.forEach(form => form.markAllAsTouched());
      this.toast.error('Revisa las celdas marcadas antes de confirmar.');
      return;
    }

    this.bulkEditSaving = true;
    const requests = modifiedProducts.map(product =>
      this.productService.updateProduct(product.id, this.toProductRequest(this.bulkEditForms[product.id]))
    );

    forkJoin(requests).subscribe({
      next: updatedProducts => {
        const updatedMap = new Map(updatedProducts.map(product => [product.id, product]));
        this.products = this.products.map(product => updatedMap.get(product.id) ?? product);
        this.bulkEditSaving = false;
        this.toast.success(`${updatedProducts.length} producto(s) actualizados.`);
        this.cancelBulkEdit(true);
      },
      error: err => {
        this.bulkEditSaving = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron guardar los cambios masivos');
      }
    });
  }

  bulkForm(productId: string): FormGroup {
    return this.bulkEditForms[productId] ?? this.editForm;
  }

  isBulkProductModified(productId: string): boolean {
    return this.bulkEditMode && this.modifiedBulkProductIds.has(productId);
  }

  isBulkFieldChanged(productId: string, field: string): boolean {
    if (!this.bulkEditMode || !this.isBulkProductModified(productId)) {
      return false;
    }

    const form = this.bulkEditForms[productId];
    const snapshot = this.bulkEditSnapshots[productId];
    if (!form || !snapshot) {
      return false;
    }

    const current = this.normalizeBulkRequest(this.toProductRequest(form)) as Record<string, unknown>;
    const base = this.normalizeBulkRequest(snapshot) as Record<string, unknown>;
    if (field === 'allowsManualSaleValue') {
      return current['allowsManualSaleValue'] !== base['allowsManualSaleValue'];
    }
    return current[field] !== base[field];
  }

  isBulkFieldInvalid(productId: string, field: string): boolean {
    if (!this.bulkEditMode) {
      return false;
    }

    const control = this.bulkEditForms[productId]?.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasPendingBulkChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = true;
  }

  stockMovementLabel(type: number): string {
    switch (type) {
      case 1: return 'Ingreso manual';
      case 2: return 'Ajuste manual';
      case 3: return 'Reserva';
      case 4: return 'Liberacion';
      case 5: return 'Salida';
      default: return 'Movimiento';
    }
  }

  acceptOnboardingStep(): void {
    const step = this.currentOnboardingStep;
    if (step) {
      this.onboardingService.acceptStep(step);
    }
  }

  get sortedProducts(): ProductResponse[] {
    if (!this.sortColumn) return this.products;
    const col = this.sortColumn;
    const dir = this.sortDir === 'desc' ? -1 : 1;
    return [...this.products].sort((a, b) => {
      let av: any = col === 'publicPrice' ? productPublicPrice(a) : (a as any)[col];
      let bv: any = col === 'publicPrice' ? productPublicPrice(b) : (b as any)[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }

  setSort(col: string): void {
    if (this.sortColumn === col) {
      this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortColumn = col;
      this.sortDir = 'desc';
    }
  }

  private loadProducts(): void {
    this.loading = true;
    this.productService.listProductsPaged(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.products = response.items;
        this.currentPage = response.page;
        this.pageSize = response.pageSize;
        this.totalProducts = response.totalCount;
        this.totalPages = response.totalPages;
        this.loading = false;
        if (this.bulkEditMode) {
          this.enterBulkEditMode();
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudieron cargar los productos');
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
        this.loading = false;
        this.cancelBulkEdit(true);
      }
    });
  }

  private loadBranches(): void {
    this.branchService.listBranches().subscribe({
      next: branches => this.branches = branches,
      error: () => this.branches = []
    });
  }

  private openModal(product: ProductResponse): void {
    this.selectedProduct = product;
    this.editPriceMode = productAllowsManualSaleValue(product) ? 'public' : 'public';
    this.editForm.reset({
      code: product.code,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      description: product.description ?? '',
      publicPrice: product.publicPrice ?? product.price,
      price: product.publicPrice ?? product.price,
      costPrice: product.costPrice ?? 0,
      unitPrice: product.unitPrice ?? null,
      marginPercent: this.calculateMarginPercent(product.publicPrice ?? product.price, product.costPrice ?? 0),
      allowsManualSaleValue: productAllowsManualSaleValue(product),
      noDeliverySurcharge: product.noDeliverySurcharge ?? null
    });
    this.updatePriceValidators(this.editForm);
  }

  private bulkProductFormValue(product: ProductResponse) {
    return {
      code: product.code,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      description: product.description ?? '',
      publicPrice: product.publicPrice ?? product.price,
      price: product.publicPrice ?? product.price,
      costPrice: product.costPrice ?? 0,
      unitPrice: product.unitPrice ?? null,
      marginPercent: this.calculateMarginPercent(product.publicPrice ?? product.price, product.costPrice ?? 0),
      allowsManualSaleValue: productAllowsManualSaleValue(product),
      noDeliverySurcharge: product.noDeliverySurcharge ?? null
    };
  }

  private hasPendingBulkChanges(): boolean {
    return this.bulkEditMode && this.modifiedBulkProductIds.size > 0;
  }

  private canLeaveBulkEdit(): boolean {
    if (!this.bulkEditMode) {
      return true;
    }

    if (!this.hasPendingBulkChanges()) {
      this.cancelBulkEdit(true);
      return true;
    }

    const shouldLeave = window.confirm('Hay cambios sin guardar en la grilla. Si sales del modo edicion, se perderan.');
    if (shouldLeave) {
      this.cancelBulkEdit(true);
    }

    return shouldLeave;
  }

  private refreshBulkProductState(productId: string): void {
    const form = this.bulkEditForms[productId];
    const snapshot = this.bulkEditSnapshots[productId];
    if (!form || !snapshot) {
      return;
    }

    const current = this.normalizeBulkRequest(this.toProductRequest(form));
    const base = this.normalizeBulkRequest(snapshot);

    if (this.areBulkRequestsEqual(current, base)) {
      this.modifiedBulkProductIds.delete(productId);
      return;
    }

    this.modifiedBulkProductIds.add(productId);
  }

  private normalizeBulkRequest(request: ReturnType<ProductsComponent['toProductRequest']>) {
    return {
      code: request.code.trim(),
      sku: request.sku.trim(),
      brand: request.brand.trim(),
      name: request.name.trim(),
      description: request.description ?? null,
      publicPrice: Number(request.publicPrice ?? 0),
      price: Number(request.price ?? 0),
      costPrice: Number(request.costPrice ?? 0),
      unitPrice: request.unitPrice == null ? null : Number(request.unitPrice),
      allowsManualValueInSale: Boolean(request.allowsManualValueInSale),
      noDeliverySurcharge: request.noDeliverySurcharge == null ? null : Number(request.noDeliverySurcharge)
    };
  }

  private areBulkRequestsEqual(
    left: ReturnType<ProductsComponent['toProductRequest']>,
    right: ReturnType<ProductsComponent['toProductRequest']>
  ): boolean {
    return left.code === right.code
      && left.sku === right.sku
      && left.brand === right.brand
      && left.name === right.name
      && left.description === right.description
      && left.publicPrice === right.publicPrice
      && left.price === right.price
      && left.costPrice === right.costPrice
      && left.unitPrice === right.unitPrice
      && left.allowsManualValueInSale === right.allowsManualValueInSale
      && left.noDeliverySurcharge === right.noDeliverySurcharge;
  }

  private buildForm(): FormGroup {
    const form = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(50)]],
      sku: ['', [Validators.required, Validators.maxLength(80)]],
      brand: ['', [Validators.required, Validators.maxLength(100)]],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(1000)]],
      publicPrice: [0, [Validators.required, Validators.min(0)]],
      price: [0],
      costPrice: [0, [Validators.required, Validators.min(0)]],
      unitPrice: [null, [Validators.min(0)]],
      marginPercent: [0, [Validators.min(0)]],
      allowsManualSaleValue: [false],
      noDeliverySurcharge: [null, [Validators.min(0)]]
    });

    this.updatePriceValidators(form);
    return form;
  }

  private syncPriceMode(form: FormGroup, mode: 'public' | 'margin'): void {
    if (form.get('allowsManualSaleValue')?.value) {
      form.patchValue({ publicPrice: 0, price: 0, marginPercent: 0 }, { emitEvent: false });
      return;
    }

    if (mode === 'margin') {
      form.patchValue({
        marginPercent: this.calculateMarginPercent(
          Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0),
          Number(form.get('costPrice')?.value ?? 0)
        )
      }, { emitEvent: false });
      this.syncPriceFromMargin(form, mode);
      return;
    }

    const publicPrice = Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
    form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
  }

  private calculateMarginPercent(publicPrice: number, costPrice: number): number {
    if (costPrice <= 0 || publicPrice < 0) {
      return 0;
    }

    return ((publicPrice - costPrice) / costPrice) * 100;
  }

  private toProductRequest(form: FormGroup) {
    const raw = form.getRawValue();
    const allowsManualSaleValue = Boolean(raw.allowsManualSaleValue);
    const publicPrice = allowsManualSaleValue ? 0 : Number(raw.publicPrice ?? raw.price ?? 0);

    return {
      code: String(raw.code || ''),
      sku: String(raw.sku || ''),
      brand: String(raw.brand || ''),
      name: String(raw.name || ''),
      description: raw.description?.trim() ? raw.description.trim() : null,
      publicPrice,
      price: publicPrice,
      costPrice: Number(raw.costPrice ?? 0),
      unitPrice: raw.unitPrice === null || raw.unitPrice === '' ? null : Number(raw.unitPrice),
      allowsManualValueInSale: allowsManualSaleValue,
      noDeliverySurcharge: raw.noDeliverySurcharge === null || raw.noDeliverySurcharge === '' ? null : Number(raw.noDeliverySurcharge)
    };
  }

  private updatePriceValidators(form: FormGroup): void {
    const allowsManualSaleValue = Boolean(form.get('allowsManualSaleValue')?.value);
    const publicPriceControl = form.get('publicPrice');

    if (!publicPriceControl) {
      return;
    }

    publicPriceControl.setValidators([
      Validators.required,
      Validators.min(allowsManualSaleValue ? 0 : 0.01)
    ]);

    publicPriceControl.updateValueAndValidity({ emitEvent: false });
  }

  private refreshOnboarding(force = false): void {
    this.onboardingService.fetchStatus(force).subscribe({
      next: status => {
        const completedOnThisRefresh = !!this.onboardingStatus && !this.onboardingStatus.isCompleted && status.isCompleted;
        this.onboardingStatus = status;

        if (force && completedOnThisRefresh) {
          this.router.navigate(['/sales']);
          return;
        }

        const nextRoute = this.onboardingService.routeForStep(status.nextStep);
        if (!status.isCompleted && nextRoute && nextRoute !== '/products') {
          this.router.navigate([nextRoute]);
        }
      }
    });
  }

  private get currentOnboardingStep(): 'Product' | 'Stock' | null {
    if (this.showProductOnboarding) return 'Product';
    if (this.showStockOnboarding) return 'Stock';
    return null;
  }
}
