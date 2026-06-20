import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupplierAccountService } from '../../core/services/supplier-account.service';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierAccount, SupplierAccountMovement, AddSupplierPaymentRequest, SupplierPaymentImputacion } from '../../core/models/supplier-account.models';
import { CarteraChequeOption } from '../../core/models/cheque.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

const PAYMENT_METHOD_CHECK = 3;

@Component({
  selector: 'app-supplier-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './supplier-account.component.html',
  styleUrls: ['./purchase-detail.component.css', './supplier-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierAccountComponent implements OnInit {
  supplierId = '';
  account: SupplierAccount | null = null;
  loading = true;

  // Form de pago
  showPaymentForm = false;
  addingPayment = false;
  cancellingPaymentId: string | null = null;
  expandedPaymentId: string | null = null;
  newMethod = 1;
  newAmount = 0;
  newDate = '';
  newReference = '';
  newNotes = '';
  newChequeId = '';
  carteraCheques: CarteraChequeOption[] = [];
  carteraLoading = false;

  readonly paymentMethods = [
    { value: 1, label: 'Efectivo' },
    { value: 2, label: 'Transferencia' },
    { value: 3, label: 'Cheque' },
    { value: 4, label: 'Otro' }
  ];

  constructor(
    private readonly supplierAccountService: SupplierAccountService,
    private readonly purchaseService: PurchaseService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.newDate = this.todayIso();
    this.supplierId = this.route.snapshot.paramMap.get('supplierId') ?? '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.supplierAccountService.getAccount(this.supplierId).subscribe({
      next: account => { this.account = account; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar la cuenta del proveedor'); this.loading = false; this.cdr.markForCheck(); }
    });
  }

  get compras(): SupplierAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'compra');
  }

  get pagos(): SupplierAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'pago');
  }

  get methodOptions(): SearchableSelectOption[] {
    return this.paymentMethods.map(m => ({ value: m.value, label: m.label }));
  }

  get isChequeMethod(): boolean {
    return this.newMethod === PAYMENT_METHOD_CHECK;
  }

  get chequeOptions(): SearchableSelectOption[] {
    return this.carteraCheques.map(c => ({
      value: c.id,
      label: `#${c.numero} · ${c.titular} · $${this.formatCurrency(c.monto)} · vence ${this.formatDate(c.fechaVencimiento)}`
    }));
  }

  // ── Compras ────────────────────────────────────────────────
  goToCompra(id: string): void {
    this.router.navigate(['/purchases', id]);
  }

  addCompra(): void {
    this.router.navigate(['/purchases/new'], { queryParams: { supplierId: this.supplierId } });
  }

  // ── Pagos ──────────────────────────────────────────────────
  togglePaymentForm(): void {
    this.showPaymentForm = !this.showPaymentForm;
    if (this.showPaymentForm) this.resetPaymentForm();
  }

  onMethodChange(method: number): void {
    this.newMethod = method;
    this.newChequeId = '';
    if (this.isChequeMethod) {
      this.newAmount = 0;
      this.loadCarteraCheques();
    }
    this.cdr.markForCheck();
  }

  onChequeSelected(chequeId: string): void {
    this.newChequeId = chequeId;
    const cheque = this.carteraCheques.find(c => c.id === chequeId);
    this.newAmount = cheque ? cheque.monto : 0;
    this.cdr.markForCheck();
  }

  private loadCarteraCheques(): void {
    this.carteraLoading = true;
    this.purchaseService.listCarteraCheques().subscribe({
      next: cheques => { this.carteraCheques = cheques; this.carteraLoading = false; this.cdr.markForCheck(); },
      error: () => { this.carteraCheques = []; this.carteraLoading = false; this.cdr.markForCheck(); }
    });
  }

  get canSubmitPayment(): boolean {
    if (this.addingPayment || this.newAmount <= 0 || !this.newDate) return false;
    if (this.isChequeMethod && !this.newChequeId) return false;
    return true;
  }

  submitPayment(): void {
    if (!this.canSubmitPayment) return;
    this.addingPayment = true;
    const req: AddSupplierPaymentRequest = {
      method: this.newMethod,
      amount: this.newAmount,
      date: this.newDate,
      reference: this.newReference.trim() || null,
      notes: this.newNotes.trim() || null,
      chequeId: this.isChequeMethod ? this.newChequeId : null
    };
    this.supplierAccountService.addPayment(this.supplierId, req).subscribe({
      next: res => {
        this.addingPayment = false;
        this.showPaymentForm = false;
        const imputadas = (res?.imputaciones ?? [])
          .map(i => `${i.code} $${this.formatCurrency(i.amount)}`)
          .join(', ');
        if (imputadas) {
          this.toast.success(`Pago registrado. Imputado a: ${imputadas}`);
        } else if (res?.creditAdded && res.creditAdded > 0) {
          const added = res.creditAdded.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const balance = (res.supplierCreditBalance ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
          this.toast.success(`Pago registrado. Saldo a favor: +$${added} (total $${balance})`);
        } else {
          this.toast.success('Pago registrado');
        }
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.addingPayment = false;
        this.toast.error(err?.error?.detail || 'No se pudo registrar el pago');
        this.cdr.markForCheck();
      }
    });
  }

  async cancelPayment(m: SupplierAccountMovement): Promise<void> {
    const facturas = (m.imputaciones ?? []).map(i => i.code).join(', ');
    const detail = facturas
      ? `Vuelven a pendiente: ${facturas}. Se revierte caja/cheque.`
      : 'Las compras imputadas vuelven a pendiente y se revierte caja/cheque.';
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de proveedor',
      title: 'Anular pago',
      message: `Se anulará el pago de $${this.formatCurrency(m.amount)}.`,
      detail,
      confirmLabel: 'Anular pago',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.cancellingPaymentId = m.id;
    this.supplierAccountService.cancelPayment(this.supplierId, m.id).subscribe({
      next: () => { this.cancellingPaymentId = null; this.toast.success('Pago anulado'); this.load(); },
      error: (err: { error?: { detail?: string } }) => {
        this.cancellingPaymentId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular el pago');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Desglose pago → facturas (A) ───────────────────────────
  togglePaymentDetail(m: SupplierAccountMovement): void {
    if (!this.hasImputaciones(m)) return;
    this.expandedPaymentId = this.expandedPaymentId === m.id ? null : m.id;
    this.cdr.markForCheck();
  }

  isExpanded(m: SupplierAccountMovement): boolean {
    return this.expandedPaymentId === m.id;
  }

  hasImputaciones(m: SupplierAccountMovement): boolean {
    return (m.imputaciones?.length ?? 0) > 0 || (m.sobrante ?? 0) > 0;
  }

  facturaLabel(i: SupplierPaymentImputacion): string {
    return i.invoiceNumber ? `Factura ${i.invoiceNumber} (${i.code})` : i.code;
  }

  private resetPaymentForm(): void {
    this.newMethod = 1;
    this.newAmount = 0;
    this.newDate = this.todayIso();
    this.newReference = '';
    this.newNotes = '';
    this.newChequeId = '';
  }

  // legacy/cancelled markers
  isActiveMovement(m: SupplierAccountMovement): boolean {
    return m.status === 1;
  }

  statusChipClass(m: SupplierAccountMovement): string {
    if (m.status === 3) return 'chip--muted';      // cancelada
    if (m.status === 2) return m.type === 'compra' ? 'chip--success' : 'chip--muted'; // pagada / anulado
    return 'chip--warning';
  }

  statusLabel(m: SupplierAccountMovement): string {
    if (m.type === 'compra') {
      switch (m.status) {
        case 1: return 'Pendiente';
        case 2: return 'Pagada';
        case 3: return 'Cancelada';
        default: return '—';
      }
    }
    return m.status === 1 ? 'Activo' : 'Anulado';
  }

  formatCurrency(value: number): string {
    return formatMoney(value);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
