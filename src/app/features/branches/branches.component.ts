import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchResponse } from '../../core/models/branch.models';
import { BranchService } from '../../core/services/branch.service';
import { ToastService } from '../../shared/services/toast.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { StockService } from '../../core/services/stock.service';
import { ProductResponse } from '../../core/models/product.models';
import { PermissionCodes } from '../../core/models/permission.models';

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
  transferStockLoading = false;
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
    private readonly stockService: StockService
  ) {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      address: ['']
    });
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      address: ['']
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

    if (this.canTransferStock) {
      this.loadProducts();
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

  get transferItems(): FormArray {
    return this.transferForm.get('items') as FormArray;
  }

  get branchSelectOptions(): SearchableSelectOption[] {
    return this.branches.map(item => ({ value: item.branch.id, label: item.branch.name }));
  }

  get transferDestinationOptions(): SearchableSelectOption[] {
    const sourceId = this.transferForm.get('sourceBranchId')?.value;
    return this.branches
      .filter(item => item.branch.id !== sourceId)
      .map(item => ({ value: item.branch.id, label: item.branch.name }));
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
    this.stockService.transferStock({
      sourceBranchId: raw.sourceBranchId,
      destinationBranchId: raw.destinationBranchId,
      items,
      description: raw.description || null
    }).subscribe({
      next: result => {
        this.savingTransfer = false;
        this.toast.success(`Traspaso realizado: ${result.items.length} producto(s)`);
        this.resetTransferForm();
        this.loadSourceAvailability();
      },
      error: err => {
        this.savingTransfer = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo transferir el stock');
      }
    });
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
      address: branch.address || ''
    });
  }

  saveEdit(): void {
    if (!this.editingBranch || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.savingEdit = true;
    this.branchService.updateBranch(this.editingBranch.id, this.editForm.getRawValue()).subscribe({
      next: () => {
        const editedBranchId = this.editingBranch?.id;
        this.savingEdit = false;
        this.editingBranch = null;
        this.loadBranches(editedBranchId);
        this.toast.success('Sucursal actualizada');
      },
      error: err => {
        this.savingEdit = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar la sucursal');
      }
    });
  }

  closeEdit(): void {
    if (this.savingEdit) {
      return;
    }

    this.editingBranch = null;
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
