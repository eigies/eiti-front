import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ImportProductRowRequest, ImportProductsResponse, ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../core/models/product.models';
import { ToastService } from '../../shared/services/toast.service';
import { BranchService } from '../../core/services/branch.service';
import { BranchResponse } from '../../core/models/branch.models';
import { StockService } from '../../core/services/stock.service';
import { BranchProductStockResponse, StockMovementResponse } from '../../core/models/stock.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

type ProductsViewMode = 'list' | 'create' | 'detail';
type ProductImportColumn =
  | 'code'
  | 'sku'
  | 'brand'
  | 'name'
  | 'description'
  | 'publicPrice'
  | 'costPrice'
  | 'unitPrice'
  | 'allowsManualValueInSale'
  | 'noDeliverySurcharge'
  | 'branchName'
  | 'initialStock';

type ProductImportRow = Record<ProductImportColumn, string | number | boolean | null>;

const PRODUCT_IMPORT_HEADERS: ProductImportColumn[] = [
  'code',
  'sku',
  'brand',
  'name',
  'description',
  'publicPrice',
  'costPrice',
  'unitPrice',
  'allowsManualValueInSale',
  'noDeliverySurcharge',
  'branchName',
  'initialStock'
];

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OnboardingBannerComponent, SearchableSelectComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  @ViewChild('importFileInput') importFileInput?: ElementRef<HTMLInputElement>;

  createPriceMode: 'public' | 'margin' = 'public';
  editPriceMode: 'public' | 'margin' = 'public';
  createForm: FormGroup;
  editForm: FormGroup;
  stockForm: FormGroup;
  bulkEditForms: Record<string, FormGroup> = {};
  bulkEditSnapshots: Record<string, ReturnType<ProductsComponent['toProductRequest']>> = {};
  modifiedBulkProductIds = new Set<string>();
  selectedBulkProductIds = new Set<string>();
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
  viewMode: ProductsViewMode = 'list';
  routeProductId = '';
  deleteConfirmOpen = false;
  currentPage = 1;
  pageSize = 10;
  filterBrand = '';
  filterCode = '';
  filterSku = '';
  filterProduct = '';
  filterNoCost = false;
  costPriceAlertDismissed = false;
  selectedProduct: ProductResponse | null = null;
  onboardingStatus: OnboardingStatusResponse | null = null;
  selectedStockBranchId = '';
  selectedBranchStock: BranchProductStockResponse | null = null;
  stockMovements: StockMovementResponse[] = [];
  compactMode = true;
  sortColumn: string | null = null;
  sortDir: 'asc' | 'desc' = 'desc';
  importInProgress = false;
  importReport: ImportProductsResponse | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private branchService: BranchService,
    private stockService: StockService,
    private toast: ToastService,
    private onboardingService: OnboardingService,
    private route: ActivatedRoute,
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
    this.route.paramMap.subscribe(params => {
      this.routeProductId = params.get('id') ?? '';
      this.viewMode = this.router.url.endsWith('/new') ? 'create' : this.routeProductId ? 'detail' : 'list';
      this.deleteConfirmOpen = false;
      if (this.viewMode === 'detail') {
        this.selectProductFromRoute();
      } else {
        this.selectedProduct = null;
      }
    });
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
    return this.auth.hasPermission(PermissionCodes.productsViewCost);
  }

  get canManageStock(): boolean {
    return this.auth.hasPermission(PermissionCodes.stockManage);
  }

  get canDeleteProduct(): boolean {
    return this.auth.hasPermission(PermissionCodes.productsDelete);
  }

  get noCostProductCount(): number {
    return this.products.filter(p => !p.costPrice || p.costPrice === 0).length;
  }

  get showCostPriceAlert(): boolean {
    return !this.costPriceAlertDismissed
      && this.auth.hasPermission(PermissionCodes.productsCostPriceAlert)
      && this.noCostProductCount > 0
      && this.viewMode === 'list';
  }

  dismissCostPriceAlert(): void {
    this.costPriceAlertDismissed = true;
  }

  activateNoCostFilter(): void {
    this.filterNoCost = true;
    this.costPriceAlertDismissed = true;
    this.currentPage = 1;
  }

  toggleNoCostFilter(): void {
    this.filterNoCost = !this.filterNoCost;
    this.currentPage = 1;
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

  get totalProducts(): number {
    return this.filteredProducts.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalProducts / this.pageSize));
  }

  get selectedBulkProductsCount(): number {
    return this.selectedBulkProductIds.size;
  }

  get brandOptions(): string[] {
    return [...new Set(this.products.map(product => product.brand).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  }

  get brandSelectOptions(): SearchableSelectOption[] {
    return this.brandOptions.map(brand => ({ value: brand, label: brand }));
  }

  get pageSizeSelectOptions(): SearchableSelectOption[] {
    return this.pageSizeOptions.map(option => ({ value: option, label: String(option) }));
  }

  get branchSelectOptions(): SearchableSelectOption[] {
    return this.branches.map(branch => ({ value: branch.id, label: branch.name }));
  }

  readonly stockMovementOptions: SearchableSelectOption[] = [
    { value: 1, label: 'Ingreso manual' },
    { value: 2, label: 'Ajuste manual' }
  ];

  get modifiedProductsCount(): number {
    return this.modifiedBulkProductIds.size;
  }

  get invalidBulkRowsCount(): number {
    return [...this.modifiedBulkProductIds].filter(productId => {
      const form = this.bulkEditForms[productId];
      if (!form) return false;
      return Object.values(form.controls).some(c => c.invalid && (c.dirty || c.touched));
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
        this.router.navigate(['/products', product.id]);
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
    this.router.navigate(['/products', product.id]);
  }

  openDelete(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.selectedProduct = product;
    this.openModal(product);
    this.deleteConfirmOpen = true;
  }

  openStock(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.selectedProduct = product;
    this.stockForm.reset({ type: 1, quantity: 1, description: '' });
    this.stockMovements = [];
    this.selectedBranchStock = null;
    this.selectedStockBranchId = '';
  }

  toggleCompactMode(): void {
    this.compactMode = !this.compactMode;
  }

  goToList(): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.router.navigate(['/products']);
  }

  goToCreate(): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.router.navigate(['/products/new']);
  }

  downloadImportTemplate(): void {
    const branchNames = this.branches.map(b => b.name);
    const dataRows: ProductImportRow[] = this.products.length > 0
      ? this.products.map(product => ({
          code: product.code,
          sku: product.sku,
          brand: product.brand,
          name: product.name,
          description: product.description ?? null,
          publicPrice: product.publicPrice ?? product.price,
          costPrice: product.costPrice ?? 0,
          unitPrice: product.unitPrice ?? null,
          allowsManualValueInSale: product.allowsManualValueInSale,
          noDeliverySurcharge: product.noDeliverySurcharge ?? null,
          branchName: null,
          initialStock: null
        }))
      : [{
          code: '', sku: '', brand: '', name: '', description: null,
          publicPrice: null, costPrice: 0, unitPrice: null,
          allowsManualValueInSale: false, noDeliverySurcharge: null,
          branchName: null, initialStock: null
        }];

    const wb = new ExcelJS.Workbook();

    // Hidden helper sheet with branch names for the dropdown formula
    const branchSheet = wb.addWorksheet('_Sucursales', { state: 'veryHidden' });
    branchNames.forEach((name, i) => { branchSheet.getCell(i + 1, 1).value = name; });

    const ws = wb.addWorksheet('Productos');

    // Header row
    ws.addRow(PRODUCT_IMPORT_HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

    // Column widths
    const widths: Record<string, number> = {
      code: 14, sku: 14, brand: 18, name: 28, description: 30,
      publicPrice: 14, costPrice: 12, unitPrice: 12,
      allowsManualValueInSale: 22, noDeliverySurcharge: 20,
      branchName: 22, initialStock: 14
    };
    PRODUCT_IMPORT_HEADERS.forEach((h, i) => {
      ws.getColumn(i + 1).width = widths[h] ?? 16;
    });

    // Data rows
    dataRows.forEach(row => {
      ws.addRow(PRODUCT_IMPORT_HEADERS.map(h => row[h]));
    });

    // Data validation: branchName column (col index = position of 'branchName' + 1)
    const branchColIdx = PRODUCT_IMPORT_HEADERS.indexOf('branchName') + 1;
    if (branchNames.length > 0) {
      for (let r = 2; r <= dataRows.length + 1; r++) {
        ws.getCell(r, branchColIdx).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_Sucursales!$A$1:$A$${branchNames.length}`],
          showErrorMessage: true,
          errorTitle: 'Sucursal inválida',
          error: 'Seleccioná una sucursal de la lista.'
        };
      }
    }

    wb.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-productos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  openImportPicker(): void {
    if (!this.canLeaveBulkEdit() || this.importInProgress) {
      return;
    }

    this.importFileInput?.nativeElement.click();
  }

  closeImportReport(): void {
    this.importReport = null;
  }

  importErrorRows(report: ImportProductsResponse) {
    return report.rows.filter(row => row.action === 'error');
  }

  importProductsFromFile(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.importInProgress = true;
    this.importReport = null;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = this.parseImportRows(reader.result);
        this.productService.importProducts(rows).subscribe({
          next: report => {
            this.importReport = report;
            this.importInProgress = false;
            this.toast.success(`Importacion finalizada: ${report.createdCount} creados, ${report.updatedCount} actualizados, ${report.errorCount} rechazados.`);
            this.resetImportInput();
            this.currentPage = 1;
            this.loadProducts();
          },
          error: err => {
            this.importInProgress = false;
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo importar el archivo');
            this.resetImportInput();
          }
        });
      } catch (error) {
        this.importInProgress = false;
        this.toast.error(error instanceof Error ? error.message : 'El archivo no tiene un formato valido.');
        this.resetImportInput();
      }
    };

    reader.onerror = () => {
      this.importInProgress = false;
      this.toast.error('No se pudo leer el archivo seleccionado.');
      this.resetImportInput();
    };

    reader.readAsArrayBuffer(file);
  }

  goToProduct(product: ProductResponse): void {
    if (this.bulkEditMode || !this.canLeaveBulkEdit()) {
      return;
    }
    this.router.navigate(['/products', product.id]);
  }

  setFilter(field: 'brand' | 'code' | 'sku' | 'product', value: string): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    if (field === 'brand') this.filterBrand = value;
    if (field === 'code') this.filterCode = value;
    if (field === 'sku') this.filterSku = value;
    if (field === 'product') this.filterProduct = value;
    this.currentPage = 1;
    this.selectedBulkProductIds.clear();
  }

  clearFilters(): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.filterBrand = '';
    this.filterCode = '';
    this.filterSku = '';
    this.filterProduct = '';
    this.filterNoCost = false;
    this.currentPage = 1;
    this.selectedBulkProductIds.clear();
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
      this.toast.error('Revisa los campos marcados: hay datos invalidos en el formulario.');
      return;
    }

    this.updating = true;
    this.productService.updateProduct(this.selectedProduct.id, this.toProductRequest(this.editForm)).subscribe({
      next: (updated) => {
        this.products = this.products.map(product => product.id === updated.id ? updated : product);
        this.toast.success(`Producto "${updated.name}" actualizado`);
        this.updating = false;
        this.selectedProduct = updated;
        this.openModal(updated);
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
        this.deleteConfirmOpen = false;
        this.loadProducts();
        this.router.navigate(['/products']);
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
    if (this.selectedBulkProductIds.size === 0) {
      this.toast.error('Selecciona al menos un producto para editar.');
      return;
    }

    this.bulkEditMode = true;
    this.bulkEditSaving = false;
    this.bulkEditForms = {};
    this.bulkEditSnapshots = {};
    this.modifiedBulkProductIds = new Set<string>();

    for (const product of this.products.filter(product => this.selectedBulkProductIds.has(product.id))) {
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
    this.selectedBulkProductIds.clear();
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
      .filter((form): form is FormGroup => !!form && Object.values(form.controls).some(c => c.invalid && (c.dirty || c.touched)));

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
        this.loadProducts();
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

  isBulkProductSelected(productId: string): boolean {
    return this.selectedBulkProductIds.has(productId);
  }

  isBulkRowEditable(productId: string): boolean {
    return this.bulkEditMode && this.selectedBulkProductIds.has(productId);
  }

  toggleBulkProduct(product: ProductResponse, checked: boolean): void {
    if (this.bulkEditMode) {
      return;
    }

    if (checked) {
      this.selectedBulkProductIds.add(product.id);
      return;
    }

    this.selectedBulkProductIds.delete(product.id);
  }

  get allFilteredSelected(): boolean {
    const filtered = this.filteredProducts;
    return filtered.length > 0 && filtered.every(product => this.selectedBulkProductIds.has(product.id));
  }

  get someFilteredSelected(): boolean {
    const filtered = this.filteredProducts;
    const selected = filtered.filter(product => this.selectedBulkProductIds.has(product.id)).length;
    return selected > 0 && selected < filtered.length;
  }

  toggleSelectAllFiltered(checked: boolean): void {
    if (this.bulkEditMode) {
      return;
    }

    const filtered = this.filteredProducts;
    if (checked) {
      filtered.forEach(product => this.selectedBulkProductIds.add(product.id));
      return;
    }

    filtered.forEach(product => this.selectedBulkProductIds.delete(product.id));
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
      case 6: return 'Canje (ingreso)';
      case 7: return 'Devolucion de venta';
      case 8: return 'Ingreso por compra';
      case 9: return 'Devolucion de compra';
      case 10: return 'Transferencia (salida)';
      case 11: return 'Transferencia (entrada)';
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
    const filtered = this.filteredProducts;
    const sorted = !this.sortColumn ? filtered : [...filtered].sort((a, b) => {
      const col = this.sortColumn as string;
      const dir = this.sortDir === 'desc' ? -1 : 1;
      let av: any = col === 'publicPrice' ? productPublicPrice(a) : (a as any)[col];
      let bv: any = col === 'publicPrice' ? productPublicPrice(b) : (b as any)[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  get filteredProducts(): ProductResponse[] {
    const brand = this.filterBrand.trim().toLowerCase();
    const code = this.filterCode.trim().toLowerCase();
    const sku = this.filterSku.trim().toLowerCase();
    const productQuery = this.filterProduct.trim().toLowerCase();

    return this.products.filter(product => {
      const matchesBrand = !brand || product.brand.toLowerCase() === brand;
      const matchesCode = !code || product.code.toLowerCase().includes(code);
      const matchesSku = !sku || product.sku.toLowerCase().includes(sku);
      const matchesProduct = !productQuery || product.name.toLowerCase().includes(productQuery);
      const matchesNoCost = !this.filterNoCost || (!product.costPrice || product.costPrice === 0);
      return matchesBrand && matchesCode && matchesSku && matchesProduct && matchesNoCost;
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
    this.productService.listProducts().subscribe({
      next: (response) => {
        this.products = response;
        this.loading = false;
        if (this.bulkEditMode) {
          this.enterBulkEditMode();
        }
        this.selectProductFromRoute();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudieron cargar los productos');
        this.products = [];
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
    this.editPriceMode = 'public';
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

  private selectProductFromRoute(): void {
    if (this.viewMode !== 'detail' || !this.routeProductId || this.products.length === 0) {
      return;
    }

    const product = this.products.find(item => item.id === this.routeProductId);
    if (!product) {
      this.toast.error('Producto no encontrado');
      this.router.navigate(['/products']);
      return;
    }

    const previousProductId = this.selectedProduct?.id ?? '';
    this.openModal(product);
    if (previousProductId !== product.id) {
      this.openStock(product);
    }
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

  private parseImportRows(source: string | ArrayBuffer | null): ImportProductRowRequest[] {
    if (!source) {
      throw new Error('El archivo seleccionado esta vacio.');
    }

    const workbook = XLSX.read(source, { type: 'array' });
    const worksheet = workbook.Sheets['Productos'] ?? workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!worksheet) {
      throw new Error('No se encontro la hoja "Productos" en el archivo.');
    }

    const headerRows = XLSX.utils.sheet_to_json<(string | null)[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: null
    });
    const normalizedHeaders = (headerRows[0] ?? []).map(header => String(header ?? '').trim());
    const missingHeaders = PRODUCT_IMPORT_HEADERS.filter(header => !normalizedHeaders.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`Faltan columnas obligatorias en el template: ${missingHeaders.join(', ')}.`);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: false
    });

    if (rawRows.length === 0) {
      throw new Error('El archivo no contiene filas de productos para importar.');
    }

    return rawRows.map((row, index) => this.mapImportRow(row, index + 2));
  }

  private mapImportRow(row: Record<string, unknown>, rowNumber: number): ImportProductRowRequest {
    const code = this.readRequiredImportText(row, 'code', rowNumber);
    const sku = this.readRequiredImportText(row, 'sku', rowNumber);
    const brand = this.readRequiredImportText(row, 'brand', rowNumber);
    const name = this.readRequiredImportText(row, 'name', rowNumber);
    const costPrice = this.readRequiredImportNumber(row, 'costPrice', rowNumber);
    const allowsManualValueInSale = this.readRequiredImportBoolean(row, 'allowsManualValueInSale', rowNumber);
    const publicPrice = this.readOptionalImportNumber(row, 'publicPrice', rowNumber);

    if (!allowsManualValueInSale && publicPrice == null) {
      throw new Error(`Fila ${rowNumber}: publicPrice es obligatorio cuando allowsManualValueInSale es false.`);
    }

    return {
      code,
      sku,
      brand,
      name,
      description: this.readOptionalImportText(row, 'description'),
      publicPrice,
      costPrice,
      unitPrice: this.readOptionalImportNumber(row, 'unitPrice', rowNumber),
      allowsManualValueInSale,
      noDeliverySurcharge: this.readOptionalImportNumber(row, 'noDeliverySurcharge', rowNumber),
      branchName: this.readOptionalImportText(row, 'branchName'),
      initialStock: this.readOptionalImportNumber(row, 'initialStock', rowNumber)
    };
  }

  private readRequiredImportText(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): string {
    const value = this.readOptionalImportText(row, key);
    if (!value) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    return value;
  }

  private readOptionalImportText(row: Record<string, unknown>, key: ProductImportColumn): string | null {
    const value = row[key];
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readRequiredImportNumber(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): number {
    const value = this.readOptionalImportNumber(row, key, rowNumber);
    if (value == null) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    return value;
  }

  private readOptionalImportNumber(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): number | null {
    const rawValue = row[key];
    if (rawValue == null || String(rawValue).trim() === '') {
      return null;
    }

    const normalizedValue = Number(String(rawValue).replace(',', '.'));
    if (!Number.isFinite(normalizedValue)) {
      throw new Error(`Fila ${rowNumber}: ${key} debe ser numerico.`);
    }

    return normalizedValue;
  }

  private readRequiredImportBoolean(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): boolean {
    const rawValue = row[key];
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    const normalizedValue = String(rawValue ?? '').trim().toLowerCase();
    if (!normalizedValue) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalizedValue)) {
      return false;
    }

    throw new Error(`Fila ${rowNumber}: ${key} debe ser true o false.`);
  }

  private resetImportInput(): void {
    if (this.importFileInput?.nativeElement) {
      this.importFileInput.nativeElement.value = '';
    }
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
      marginPercent: [0],
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
