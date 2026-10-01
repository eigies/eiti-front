import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchResponse, TransferTargetResponse, formatPointOfSale } from '../../core/models/branch.models';
import { FiscalPointOfSaleResponse } from '../../core/models/fiscal-settings.models';
import { FiscalSettingsService } from '../../core/services/fiscal-settings.service';
import { BranchService } from '../../core/services/branch.service';
import { CompanyService } from '../../core/services/company.service';
import { ToastService } from '../../shared/services/toast.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { StockService } from '../../core/services/stock.service';
import { TransferStockResponse } from '../../core/models/stock.models';
import { ProductResponse } from '../../core/models/product.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { StockTransferPdfService } from '../../shared/services/stock-transfer-pdf.service';

type BranchView = {
  branch: BranchResponse;
  expanded: boolean;
};

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OnboardingBannerComponent, SearchableSelectComponent],
  templateUrl: './branches.component.html',
  styleUrls: ['./branches.component.css']
})
export class BranchesComponent implements OnInit {
  /** '' = hereda de la empresa. El override explicito solo tiene sentido si difiere del default. */
  readonly automaticInvoicingOptions: SearchableSelectOption[] = [
    { value: '', label: 'Facturacion: hereda de la empresa' },
    { value: 'true', label: 'Facturacion: automatica' },
    { value: 'false', label: 'Facturacion: manual' }
  ];

  createForm: FormGroup;
  editForm: FormGroup;
  transferForm: FormGroup;
  branches: BranchView[] = [];
  editingBranch: BranchResponse | null = null;
  savingCreate = false;
  savingEdit = false;
  savingTransfer = false;
  onboardingStatus: OnboardingStatusResponse | null = null;

  products: ProductResponse[] = [];
  transferTargets: TransferTargetResponse[] = [];
  transferStockLoading = false;
  deletingBranchId: string | null = null;
  /** Config de la empresa, para resolver las sucursales que heredan. Null = todavia no se sabe. */
  companyAutomaticInvoicing: boolean | null = null;
  pointsOfSale: FiscalPointOfSaleResponse[] = [];
  private sourceAvailableById = new Map<string, number>();

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly onboardingService: OnboardingService,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly productService: ProductService,
    private readonly stockService: StockService,
    private readonly confirmation: ConfirmationService,
    private readonly stockTransferPdf: StockTransferPdfService,
    private readonly companyService: CompanyService,
    private readonly fiscalSettings: FiscalSettingsService
  ) {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      address: ['']
    });
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      // '' = hereda de la empresa; 'true'/'false' = override explicito de la sucursal.
      address: [''],
      automaticInvoicing: [''],
      // Uno de los puntos de venta cargados en Empresa > Facturacion electronica (1:1). Null = ninguno.
      fiscalPointOfSaleId: [null as string | null]
    });
    this.transferForm = this.fb.group({
      sourceBranchId: ['', Validators.required],
      destinationBranchId: ['', Validators.required],
      description: [''],
      items: this.fb.array([this.createTransferItem()])
    });
  }

  ngOnInit(): void {
    this.refreshOnboarding();
    this.loadBranches();
    this.loadCompanyInvoicing();
    this.loadPointsOfSale();

    if (this.canTransferStock) {
      this.loadProducts();
      this.loadTransferTargets();
      this.transferForm.get('sourceBranchId')?.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.loadSourceAvailability());
    }
  }

  get canTransferStock(): boolean {
    // Alcanza con el permiso: el usuario puede transferir entre las sucursales que tenga asignadas
    // (los selects ya vienen filtrados a las suyas). El backend valida acceso a origen y destino.
    return this.auth.hasPermission(PermissionCodes.stockTransfer);
  }

  get canViewFinancials(): boolean {
    return this.auth.hasPermission(PermissionCodes.dashboardViewFinancials);
  }

  /** Los puntos de venta los administra quien factura (Empresa > Facturacion electronica). */
  get canAssignPointOfSale(): boolean {
    return this.auth.hasPermission(PermissionCodes.salesInvoice);
  }

  get canManageBranches(): boolean {
    return this.auth.hasPermission(PermissionCodes.branchesManage);
  }

  get transferItems(): FormArray {
    return this.transferForm.get('items') as FormArray;
  }

  get branchSelectOptions(): SearchableSelectOption[] {
    return this.branches.map(item => ({ value: item.branch.id, label: item.branch.name }));
  }

  get transferDestinationOptions(): SearchableSelectOption[] {
    // Destino = todas las sucursales de la empresa (modelo "push"): enviar stock no requiere
    // tener asignada la sucursal destino ni otorga visibilidad de sus datos. Excluye el origen.
    const sourceId = this.transferForm.get('sourceBranchId')?.value;
    return this.transferTargets
      .filter(target => target.id !== sourceId)
      .map(target => ({ value: target.id, label: target.name }));
  }

  // Opciones de producto por línea: excluye los productos ya elegidos en otras líneas.
  productOptionsForLine(index: number): SearchableSelectOption[] {
    const chosen = new Set(
      this.transferItems.controls
        .map((group, i) => (i === index ? null : group.get('productId')?.value))
        .filter((value): value is string => !!value)
    );

    return this.products
      .filter(product => !chosen.has(product.id))
      .map(product => ({ value: product.id, label: `${product.code} - ${product.name}` }));
  }

  availableForProduct(productId: string | null | undefined): number | null {
    if (!productId) {
      return null;
    }
    return this.sourceAvailableById.has(productId) ? this.sourceAvailableById.get(productId)! : null;
  }

  createTransferItem(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  addTransferItem(): void {
    this.transferItems.push(this.createTransferItem());
  }

  removeTransferItem(index: number): void {
    if (this.transferItems.length <= 1) {
      return;
    }
    this.transferItems.removeAt(index);
  }

  private loadProducts(): void {
    this.productService.listProducts().subscribe({
      next: products => this.products = products,
      error: () => this.products = []
    });
  }

  private loadTransferTargets(): void {
    this.branchService.listTransferTargets().subscribe({
      next: targets => this.transferTargets = targets,
      error: () => this.transferTargets = []
    });
  }

  private loadSourceAvailability(): void {
    const sourceBranchId = this.transferForm.get('sourceBranchId')?.value;
    this.sourceAvailableById = new Map<string, number>();

    if (!sourceBranchId) {
      return;
    }

    this.transferStockLoading = true;
    this.stockService.listBranchStock(sourceBranchId).subscribe({
      next: stock => {
        this.sourceAvailableById = new Map(stock.map(item => [item.productId, item.availableQuantity]));
        this.transferStockLoading = false;
      },
      error: () => {
        this.sourceAvailableById = new Map<string, number>();
        this.transferStockLoading = false;
      }
    });
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      this.toast.error('Completa origen, destino y al menos un producto con cantidad.');
      return;
    }

    const raw = this.transferForm.getRawValue();

    if (raw.sourceBranchId === raw.destinationBranchId) {
      this.toast.error('La sucursal de origen y la de destino deben ser distintas.');
      return;
    }

    const items = (raw.items as { productId: string; quantity: number }[])
      .map(item => ({ productId: item.productId, quantity: Number(item.quantity ?? 0) }));

    if (new Set(items.map(item => item.productId)).size !== items.length) {
      this.toast.error('No podés repetir el mismo producto en el traspaso.');
      return;
    }

    for (const item of items) {
      const available = this.availableForProduct(item.productId);
      if (available !== null && item.quantity > available) {
        const product = this.products.find(p => p.id === item.productId);
        this.toast.error(`La cantidad de '${product?.name ?? 'producto'}' supera el stock disponible (${available}).`);
        return;
      }
    }

    this.savingTransfer = true;
    const description = raw.description || null;
    this.stockService.transferStock({
      sourceBranchId: raw.sourceBranchId,
      destinationBranchId: raw.destinationBranchId,
      items,
      description
    }).subscribe({
      next: result => {
        this.savingTransfer = false;
        this.toast.success(`Traspaso realizado: ${result.items.length} producto(s)`);
        this.resetTransferForm();
        this.loadSourceAvailability();
        this.offerTransferReceiptDownload(result, description);
      },
      error: err => {
        this.savingTransfer = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo transferir el stock');
      }
    });
  }

  // Post-traspaso: ofrece descargar una constancia en PDF, reutilizando el modal de
  // confirmacion global (ConfirmationService) en vez de armar un dialogo propio.
  private async offerTransferReceiptDownload(
    result: TransferStockResponse,
    description: string | null
  ): Promise<void> {
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Traspaso realizado',
      title: 'Descargar constancia',
      message: 'Queres descargar un PDF dejando constancia de este traspaso de stock?',
      confirmLabel: 'Descargar PDF',
      cancelLabel: 'No, gracias',
      tone: 'neutral'
    });

    if (!confirmed) {
      return;
    }

    const sourceBranchName = this.branchNameById(result.sourceBranchId);
    const destinationBranchName = this.branchNameById(result.destinationBranchId);

    this.stockTransferPdf.generate({
      sourceBranchName,
      destinationBranchName,
      description,
      items: result.items.map(item => ({ code: item.code, name: item.name, quantity: item.quantity }))
    }).catch(() => {
      this.toast.error('No se pudo generar el PDF del traspaso');
    });
  }

  private branchNameById(branchId: string): string {
    return this.branches.find(view => view.branch.id === branchId)?.branch.name ?? 'Sucursal';
  }

  private resetTransferForm(): void {
    const sourceBranchId = this.transferForm.get('sourceBranchId')?.value;
    const destinationBranchId = this.transferForm.get('destinationBranchId')?.value;
    this.transferItems.clear();
    this.transferItems.push(this.createTransferItem());
    this.transferForm.patchValue({ sourceBranchId, destinationBranchId, description: '' });
  }

  get isOnboardingStep(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Branch';
  }

  get isOnboardingFocusLocked(): boolean {
    return this.isOnboardingStep && !this.onboardingService.isStepAccepted('Branch');
  }

  /** Facturacion efectiva: la sucursal manda si definio un valor, si no hereda de la empresa. */
  branchInvoicesAutomatically(branch: BranchResponse): boolean | null {
    return branch.automaticInvoicing ?? this.companyAutomaticInvoicing;
  }

  branchInvoicingLabel(branch: BranchResponse): string {
    const automatic = this.branchInvoicesAutomatically(branch);
    if (automatic === null) {
      return 'Factura según empresa';
    }
    return automatic ? 'Factura automática' : 'Factura manual';
  }

  branchInvoicingOrigin(branch: BranchResponse): string {
    return branch.automaticInvoicing === null || branch.automaticInvoicing === undefined
      ? 'heredada de la empresa'
      : 'definida en la sucursal';
  }

  /** Puntos de venta que puede tomar la sucursal en edicion: los libres y el que ya tiene. */
  get pointOfSaleOptions(): SearchableSelectOption[] {
    const branchId = this.editingBranch?.id;
    const available = this.pointsOfSale.filter(p => !p.branchId || p.branchId === branchId);
    return [
      { value: null, label: 'Sin punto de venta (no factura)' },
      ...available.map(p => ({ value: p.id, label: `Punto de venta ${formatPointOfSale(p.number)}` }))
    ];
  }

  branchPointOfSaleLabel(branch: BranchResponse): string {
    return branch.fiscalPointOfSaleNumber ? formatPointOfSale(branch.fiscalPointOfSaleNumber) : 'Sin asignar';
  }

  private loadCompanyInvoicing(): void {
    // Dato secundario: si no se puede leer, las sucursales que heredan muestran "segun empresa".
    this.companyService.getCurrentCompany()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: company => this.companyAutomaticInvoicing = Boolean(company.automaticInvoicing),
        error: () => this.companyAutomaticInvoicing = null
      });
  }

  loadBranches(expandBranchId?: string): void {
    this.branchService.listBranches().subscribe({
      next: branches => {
        const expandedMap = new Map(this.branches.map(item => [item.branch.id, item.expanded]));
        this.branches = branches.map(branch => ({
          branch,
          expanded: branch.id === expandBranchId ? true : (expandedMap.get(branch.id) ?? false)
        }));
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las sucursales')
    });
  }

  createBranch(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.savingCreate = true;
    this.branchService.createBranch(this.createForm.getRawValue()).subscribe({
      next: () => {
        this.createForm.reset({ name: '', code: '', address: '' });
        this.savingCreate = false;
        this.loadBranches();
        this.toast.success('Sucursal creada');
        this.refreshOnboarding(true);
      },
      error: err => {
        this.savingCreate = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear la sucursal');
      }
    });
  }

  beginEdit(branch: BranchResponse): void {
    this.editingBranch = branch;
    this.editForm.reset({
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      automaticInvoicing: branch.automaticInvoicing === null || branch.automaticInvoicing === undefined
        ? ''
        : String(branch.automaticInvoicing),
      fiscalPointOfSaleId: branch.fiscalPointOfSaleId ?? null
    });
  }

  saveEdit(): void {
    if (!this.editingBranch || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.savingEdit = true;
    const branch = this.editingBranch;
    const raw = this.editForm.getRawValue();
    const pointOfSaleId: string | null = raw.fiscalPointOfSaleId ?? null;
    const update$ = this.branchService.updateBranch(branch.id, {
      name: raw.name,
      code: raw.code,
      address: raw.address,
      automaticInvoicing: raw.automaticInvoicing === '' ? null : raw.automaticInvoicing === 'true'
    });
    // El punto de venta se habilita en el servicio de facturacion: solo se manda si cambio.
    const save$ = update$.pipe(switchMap(() => this.applyPointOfSale(branch, pointOfSaleId)));

    save$.subscribe({
      next: () => {
        this.savingEdit = false;
        this.editingBranch = null;
        this.loadBranches(branch.id);
        this.loadPointsOfSale();
        this.toast.success('Sucursal actualizada');
      },
      error: err => {
        this.savingEdit = false;
        // Si fallo el punto de venta, el resto ya se guardo: se refresca para no mostrar datos viejos.
        this.loadBranches(branch.id);
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar la sucursal');
      }
    });
  }

  /** Solo si cambio: atar el elegido a la sucursal, o liberar el que tenia. */
  private applyPointOfSale(branch: BranchResponse, pointOfSaleId: string | null): Observable<unknown> {
    const currentId = branch.fiscalPointOfSaleId ?? null;
    if (!this.canAssignPointOfSale || pointOfSaleId === currentId) {
      return of(null);
    }
    return pointOfSaleId
      ? this.fiscalSettings.assignPointOfSale(pointOfSaleId, branch.id)
      : this.fiscalSettings.assignPointOfSale(currentId!, null); // currentId no es null: difiere de pointOfSaleId, que lo es
  }

  private loadPointsOfSale(): void {
    if (!this.canAssignPointOfSale) {
      return;
    }
    // Dato secundario: si no se puede leer, el selector queda solo con "Sin punto de venta".
    this.fiscalSettings.get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: settings => this.pointsOfSale = settings.pointsOfSale,
        error: () => this.pointsOfSale = []
      });
  }

  closeEdit(): void {
    if (this.savingEdit) {
      return;
    }

    this.editingBranch = null;
  }

  async deleteBranch(branch: BranchResponse): Promise<void> {
    if (this.deletingBranchId) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Estructura de la empresa',
      title: 'Eliminar sucursal',
      message: `Vas a eliminar la sucursal "${branch.name}".`,
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar sucursal',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }

    this.deletingBranchId = branch.id;
    this.branchService.deleteBranch(branch.id).subscribe({
      next: () => {
        this.deletingBranchId = null;
        this.toast.success('Sucursal eliminada');
        this.loadBranches();
      },
      error: err => {
        this.deletingBranchId = null;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo eliminar la sucursal');
      }
    });
  }

  toggleBranch(branchId: string, forceExpand?: boolean): void {
    this.branches = this.branches.map(item =>
      item.branch.id === branchId
        ? { ...item, expanded: forceExpand ?? !item.expanded }
        : item
    );
  }

  acceptOnboardingStep(): void {
    this.onboardingService.acceptStep('Branch');
  }

  private refreshOnboarding(force = false): void {
    this.onboardingService.fetchStatus(force).subscribe({
      next: status => {
        this.onboardingStatus = status;
        const nextRoute = this.onboardingService.routeForStep(status.nextStep);

        if (!status.isCompleted && nextRoute && nextRoute !== '/branches') {
          this.router.navigate([nextRoute]);
        }
      }
    });
  }
}
