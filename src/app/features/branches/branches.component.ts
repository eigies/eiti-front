import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchResponse, TransferTargetResponse } from '../../core/models/branch.models';
import { BranchService } from '../../core/services/branch.service';
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
    private readonly stockTransferPdf: StockTransferPdfService
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
