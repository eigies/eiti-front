import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ProductService } from '../../core/services/product.service';
import { BranchService } from '../../core/services/branch.service';
import { CreatePurchaseDetailRequest, CreatePurchaseRequest } from '../../core/models/purchase.models';
import { SupplierListItem } from '../../core/models/supplier.models';
import { ProductResponse } from '../../core/models/product.models';
import { BranchResponse } from '../../core/models/branch.models';
import { ToastService } from '../../shared/services/toast.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

interface DraftDetail {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

@Component({
  selector: 'app-purchase-create',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './purchase-create.component.html',
  styleUrls: ['./purchase-create.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseCreateComponent implements OnInit {
  suppliers: SupplierListItem[] = [];
  products: ProductResponse[] = [];
  branches: BranchResponse[] = [];
  submitting = false;

  headerForm: FormGroup;

  details: DraftDetail[] = [];

  // Product search
  productSearch = '';
  productSearchResults: ProductResponse[] = [];
  showProductResults = false;

  get branchOptions(): SearchableSelectOption[] {
    return this.branches.map(branch => ({
      value: branch.id,
      label: branch.name
    }));
  }

  get selectedSupplierCredit(): number {
    const id = this.headerForm.get('supplierId')?.value;
    if (!id) return 0;
    return this.suppliers.find(s => s.id === id)?.creditBalance ?? 0;
  }

  get supplierOptions(): SearchableSelectOption[] {
    return this.suppliers.map(supplier => ({
      value: supplier.id,
      label: supplier.name,
      meta: supplier.taxId || supplier.email || undefined,
      searchText: `${supplier.taxId ?? ''} ${supplier.email ?? ''}`
    }));
  }

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly supplierService: SupplierService,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.headerForm = this.fb.group({
      branchId: ['', Validators.required],
      supplierId: ['', Validators.required],
      invoiceNumber: [''],
      notes: [''],
      ivaPct: [''],
      ingresosBrutosPct: [null as number | null]
    });
  }

  ngOnInit(): void {
    const preSupplierId = this.route.snapshot.queryParamMap.get('supplierId');
    if (preSupplierId) {
      this.headerForm.patchValue({ supplierId: preSupplierId });
    }
    this.supplierService.listSuppliers(undefined, true).subscribe({
      next: s => { this.suppliers = s; this.cdr.markForCheck(); }
    });
    this.productService.listProducts().subscribe({
      next: p => { this.products = p; this.cdr.markForCheck(); }
    });
    this.branchService.listBranches().subscribe({
      next: b => {
        this.branches = b;
        if (b.length === 1) {
          this.headerForm.patchValue({ branchId: b[0].id });
        }
        this.cdr.markForCheck();
      }
    });
  }

  // Product search
  onProductSearchInput(): void {
    const q = this.productSearch.toLowerCase().trim();
    const source = q
      ? this.products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
        )
      : this.products;
    this.productSearchResults = source.slice(0, 12);
    this.showProductResults = this.productSearchResults.length > 0;
  }

  openProductResults(): void {
    this.onProductSearchInput();
  }

  closeProductResults(): void {
    setTimeout(() => {
      this.showProductResults = false;
      this.cdr.markForCheck();
    }, 120);
  }

  selectProduct(product: ProductResponse): void {
    this.details.push({
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: Number(product.costPrice ?? 0)
    });
    this.productSearch = '';
    this.productSearchResults = [];
    this.showProductResults = false;
    this.cdr.markForCheck();
  }

  removeDetail(index: number): void {
    this.details.splice(index, 1);
    this.cdr.markForCheck();
  }

  get totalAmount(): number {
    return this.details.reduce((s, d) => s + d.quantity * d.unitCost, 0);
  }

  get grandTotal(): number {
    return this.totalAmount + (this.ivaAmount ?? 0) + (this.iibbAmount ?? 0);
  }

  get ivaAmount(): number | null {
    const pct = this.headerForm.get('ivaPct')?.value;
    return pct ? Math.round(this.totalAmount * +pct / 100 * 100) / 100 : null;
  }

  get iibbAmount(): number | null {
    const pct = this.headerForm.get('ingresosBrutosPct')?.value;
    return pct != null && pct !== '' ? Math.round(this.totalAmount * +pct / 100 * 100) / 100 : null;
  }

  isHeaderInvalid(field: string): boolean {
    const c = this.headerForm.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.toast.error('Seleccioná sucursal y proveedor');
      return;
    }
    if (this.details.length === 0) { this.toast.error('Agregue al menos un producto'); return; }

    this.submitting = true;
    const raw = this.headerForm.getRawValue();

    const detailReqs: CreatePurchaseDetailRequest[] = this.details.map(d => ({
      productId: d.productId,
      quantity: d.quantity,
      unitCost: d.unitCost
    }));

    const req: CreatePurchaseRequest = {
      branchId: raw.branchId,
      supplierId: raw.supplierId,
      invoiceNumber: raw.invoiceNumber.trim() || null,
      notes: raw.notes.trim() || null,
      ivaPct: raw.ivaPct ? +raw.ivaPct : null,
      ingresosBrutosPct: raw.ingresosBrutosPct != null && raw.ingresosBrutosPct !== '' ? +raw.ingresosBrutosPct : null,
      details: detailReqs
    };

    this.purchaseService.createPurchase(req).subscribe({
      next: res => {
        if (res.creditApplied && res.creditApplied > 0) {
          const applied = res.creditApplied.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const remaining = (res.supplierCreditBalance ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
          this.toast.success(`Se aplicaron $${applied} de saldo a favor. Crédito restante: $${remaining}`);
        } else {
          this.toast.success('Compra registrada correctamente');
        }
        this.router.navigate(['/purchases/supplier', res.supplierId]);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al registrar la compra');
        this.submitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatCurrency(value: number): string {
    return formatMoney(value);
  }
}
