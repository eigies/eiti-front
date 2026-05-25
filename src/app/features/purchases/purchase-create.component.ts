import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ProductService } from '../../core/services/product.service';
import { BranchService } from '../../core/services/branch.service';
import { CreatePurchaseDetailRequest, CreatePurchasePaymentRequest, CreatePurchaseRequest } from '../../core/models/purchase.models';
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

interface DraftPayment {
  method: number;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

const PAYMENT_METHODS = [
  { value: 1, label: 'Efectivo' },
  { value: 2, label: 'Transferencia' },
  { value: 3, label: 'Cheque' },
  { value: 4, label: 'Otro' }
];

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
  payments: DraftPayment[] = [];

  // Product search
  productSearch = '';
  productSearchResults: ProductResponse[] = [];
  showProductResults = false;

  readonly paymentMethods = PAYMENT_METHODS;

  get branchOptions(): SearchableSelectOption[] {
    return this.branches.map(branch => ({
      value: branch.id,
      label: branch.name
    }));
  }

  get supplierOptions(): SearchableSelectOption[] {
    return this.suppliers.map(supplier => ({
      value: supplier.id,
      label: supplier.name,
      meta: supplier.taxId || supplier.email || undefined,
      searchText: `${supplier.taxId ?? ''} ${supplier.email ?? ''}`
    }));
  }

  get paymentMethodOptions(): SearchableSelectOption[] {
    return this.paymentMethods.map(method => ({
      value: method.value,
      label: method.label
    }));
  }

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly supplierService: SupplierService,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.headerForm = this.fb.group({
      branchId: ['', Validators.required],
      supplierId: [''],
      invoiceNumber: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
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

  addPayment(): void {
    this.payments.push({
      method: 1,
      amount: 0,
      date: this.todayIso(),
      reference: '',
      notes: ''
    });
    this.cdr.markForCheck();
  }

  removePayment(index: number): void {
    this.payments.splice(index, 1);
    this.cdr.markForCheck();
  }

  get totalAmount(): number {
    return this.details.reduce((s, d) => s + d.quantity * d.unitCost, 0);
  }

  get totalPaid(): number {
    return this.payments.reduce((s, p) => s + Number(p.amount), 0);
  }

  get pendingAmount(): number {
    return Math.max(0, this.totalAmount - this.totalPaid);
  }

  isHeaderInvalid(field: string): boolean {
    const c = this.headerForm.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  submit(): void {
    if (this.headerForm.invalid) { this.headerForm.markAllAsTouched(); return; }
    if (this.details.length === 0) { this.toast.error('Agregue al menos un producto'); return; }

    this.submitting = true;
    const raw = this.headerForm.getRawValue();

    const detailReqs: CreatePurchaseDetailRequest[] = this.details.map(d => ({
      productId: d.productId,
      quantity: d.quantity,
      unitCost: d.unitCost
    }));

    const paymentReqs: CreatePurchasePaymentRequest[] = this.payments
      .filter(p => Number(p.amount) > 0)
      .map(p => ({
        method: p.method,
        amount: Number(p.amount),
        date: p.date,
        reference: p.reference.trim() || null,
        notes: p.notes.trim() || null
      }));

    const req: CreatePurchaseRequest = {
      branchId: raw.branchId,
      supplierId: raw.supplierId || null,
      invoiceNumber: raw.invoiceNumber.trim() || null,
      notes: raw.notes.trim() || null,
      details: detailReqs,
      payments: paymentReqs
    };

    this.purchaseService.createPurchase(req).subscribe({
      next: res => {
        this.toast.success('Compra registrada correctamente');
        this.router.navigate(['/purchases', res.id]);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al registrar la compra');
        this.submitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
