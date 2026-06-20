import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CustomerAccountService } from '../../core/services/customer-account.service';
import { BankService } from '../../core/services/bank.service';
import { BranchService } from '../../core/services/branch.service';
import { SaleService } from '../../core/services/sale.service';
import { AuthService } from '../../core/services/auth.service';
import { RemitoPdfService } from '../../shared/services/remito-pdf.service';
import {
  CustomerAccount,
  CustomerAccountMovement,
  AddCustomerPaymentRequest,
  AddCustomerPaymentCheque,
  CustomerPaymentImputacion
} from '../../core/models/customer-account.models';
import { BankResponse, BankInstallmentPlanResponse } from '../../core/models/bank.models';
import { SaleByIdResponse } from '../../core/models/sale.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

const PAYMENT_METHOD_CARD = 3;
const PAYMENT_METHOD_CHECK = 4;

@Component({
  selector: 'app-customer-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './customer-account.component.html',
  styleUrls: ['./customer-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerAccountComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;
  customerId = '';
  account: CustomerAccount | null = null;
  loading = true;

  // Detalle de venta (modal read-only, reusado de la CC vieja)
  detalleModalOpen = false;
  detalleModalSale: SaleByIdResponse | null = null;
  detalleLoading = false;

  // Form de cobro
  showPaymentForm = false;
  addingPayment = false;
  cancellingPaymentId: string | null = null;
  expandedPaymentId: string | null = null;
  newMethod = 1;
  newAmount = 0;
  newDate = '';
  newReference = '';
  newNotes = '';

  // Tarjeta
  newCardBankId: number | null = null;
  newCardCuotas: number | null = null;

  // Cheque recibido del cliente (se crea, entra a cartera)
  newCheque: AddCustomerPaymentCheque = this.emptyCheque();

  banks: BankResponse[] = [];
  branches: { id: string; name: string }[] = [];

  readonly paymentMethods = [
    { value: 1, label: 'Efectivo' },
    { value: 2, label: 'Transferencia' },
    { value: 3, label: 'Tarjeta' },
    { value: 4, label: 'Cheque' },
    { value: 5, label: 'Otros' }
  ];

  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly bankService: BankService,
    private readonly branchService: BranchService,
    private readonly saleService: SaleService,
    private readonly remitoPdf: RemitoPdfService,
    readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.newDate = this.todayIso();
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? '';
    this.bankService.listBanks(true).subscribe({
      next: banks => { this.banks = banks; this.cdr.markForCheck(); },
      error: () => {} // non-blocking — el cobro funciona sin datos de banco
    });
    this.branchService.listBranches().subscribe({
      next: branches => { this.branches = branches.map(b => ({ id: b.id, name: b.name })); this.cdr.markForCheck(); },
      error: () => {} // non-blocking — el remito sale igual con sucursal genérica
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.customerAccountService.getAccount(this.customerId).subscribe({
      next: account => { this.account = account; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar la cuenta del cliente'); this.loading = false; this.cdr.markForCheck(); }
    });
  }

  get ventas(): CustomerAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'venta');
  }

  get cobros(): CustomerAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'cobro');
  }

  get methodOptions(): SearchableSelectOption[] {
    return this.paymentMethods.map(m => ({ value: m.value, label: m.label }));
  }

  get isCardMethod(): boolean {
    return this.newMethod === PAYMENT_METHOD_CARD;
  }

  get isChequeMethod(): boolean {
    return this.newMethod === PAYMENT_METHOD_CHECK;
  }

  // ── Tarjeta ────────────────────────────────────────────────
  get activeBanksWithPlans(): BankResponse[] {
    return this.banks.filter(b => b.active && b.plans.some(p => p.active));
  }

  get bankOptions(): SearchableSelectOption[] {
    return this.activeBanksWithPlans.map(b => ({ value: b.id, label: b.name }));
  }

  activePlansForBank(bankId: number | null): BankInstallmentPlanResponse[] {
    if (!bankId) return [];
    const bank = this.banks.find(b => b.id === bankId);
    return (bank?.plans ?? []).filter(p => p.active);
  }

  get cuotasOptions(): SearchableSelectOption[] {
    return this.activePlansForBank(this.newCardBankId).map(plan => ({
      value: plan.cuotas,
      label: `${plan.cuotas} cuota${plan.cuotas > 1 ? 's' : ''}`,
      meta: plan.surchargePct > 0 ? `Recargo ${plan.surchargePct}%` : 'Sin recargo'
    }));
  }

  get cardSurchargePct(): number | null {
    if (!this.newCardBankId || !this.newCardCuotas) return null;
    const bank = this.banks.find(b => b.id === this.newCardBankId);
    const plan = bank?.plans.find(p => p.cuotas === this.newCardCuotas && p.active);
    return plan?.surchargePct ?? null;
  }

  get cardSurchargeAmt(): number {
    const pct = this.cardSurchargePct;
    if (pct == null || pct === 0) return 0;
    return Math.round(this.newAmount * pct / 100 * 100) / 100;
  }

  onCardBankChange(bankId: number | null): void {
    this.newCardBankId = bankId;
    this.newCardCuotas = null;
    const plans = this.activePlansForBank(bankId);
    if (plans.length === 1) this.newCardCuotas = plans[0].cuotas;
    this.cdr.markForCheck();
  }

  onCardCuotasChange(cuotas: number | null): void {
    this.newCardCuotas = cuotas;
    this.cdr.markForCheck();
  }

  // ── Cobros ─────────────────────────────────────────────────
  togglePaymentForm(): void {
    this.showPaymentForm = !this.showPaymentForm;
    if (this.showPaymentForm) this.resetPaymentForm();
  }

  onMethodChange(method: number): void {
    this.newMethod = method;
    this.newCardBankId = null;
    this.newCardCuotas = null;
    this.newCheque = this.emptyCheque();
    this.cdr.markForCheck();
  }

  onAmountChange(value: number): void {
    this.newAmount = value;
    if (this.isChequeMethod) this.newCheque.monto = value;
    this.cdr.markForCheck();
  }

  get chequeBankOptions(): SearchableSelectOption[] {
    return this.banks.filter(b => b.active).map(b => ({ value: b.id, label: b.name }));
  }

  get isChequeComplete(): boolean {
    const c = this.newCheque;
    return !!(c.numero?.trim() && c.bankId > 0 && c.titular?.trim() && c.cuitDni?.trim()
      && c.monto > 0 && c.fechaEmision && c.fechaVencimiento);
  }

  get canSubmitPayment(): boolean {
    if (this.addingPayment || this.newAmount <= 0 || !this.newDate) return false;
    if (this.isCardMethod && (!this.newCardBankId || !this.newCardCuotas)) return false;
    if (this.isChequeMethod && !this.isChequeComplete) return false;
    return true;
  }

  submitPayment(): void {
    if (!this.canSubmitPayment) return;
    this.addingPayment = true;
    const req: AddCustomerPaymentRequest = {
      method: this.newMethod,
      amount: this.newAmount,
      date: this.newDate,
      reference: this.newReference.trim() || null,
      notes: this.newNotes.trim() || null,
      cardBankId: this.isCardMethod ? this.newCardBankId : null,
      cardCuotas: this.isCardMethod ? this.newCardCuotas : null,
      cheque: this.isChequeMethod ? {
        ...this.newCheque,
        monto: this.newAmount,
        notas: this.newCheque.notas?.trim() || null
      } : null
    };
    this.customerAccountService.addPayment(this.customerId, req).subscribe({
      next: res => {
        this.addingPayment = false;
        this.showPaymentForm = false;
        const imputadas = (res?.imputaciones ?? [])
          .map(i => `${i.code} $${this.formatCurrency(i.amount)}`)
          .join(', ');
        if (imputadas) {
          this.toast.success(`Cobro registrado. Imputado a: ${imputadas}`);
        } else if (res?.creditAdded && res.creditAdded > 0) {
          const added = res.creditAdded.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const balance = (res.customerCreditBalance ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
          this.toast.success(`Cobro registrado. Saldo a favor: +$${added} (total $${balance})`);
        } else {
          this.toast.success('Cobro registrado');
        }
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.addingPayment = false;
        this.toast.error(err?.error?.detail || 'No se pudo registrar el cobro');
        this.cdr.markForCheck();
      }
    });
  }

  async cancelPayment(m: CustomerAccountMovement): Promise<void> {
    const ventas = (m.imputaciones ?? []).map(i => i.code).join(', ');
    const detail = ventas
      ? `Vuelven a pendiente: ${ventas}. Se revierte caja/cheque.`
      : 'Las ventas imputadas vuelven a pendiente y se revierte caja/cheque.';
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de cliente',
      title: 'Anular cobro',
      message: `Se anulará el cobro de $${this.formatCurrency(m.amount)}.`,
      detail,
      confirmLabel: 'Anular cobro',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.cancellingPaymentId = m.id;
    this.customerAccountService.cancelPayment(this.customerId, m.id).subscribe({
      next: () => { this.cancellingPaymentId = null; this.toast.success('Cobro anulado'); this.load(); },
      error: (err: { error?: { detail?: string } }) => {
        this.cancellingPaymentId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular el cobro');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Desglose cobro → ventas (A) ────────────────────────────
  togglePaymentDetail(m: CustomerAccountMovement): void {
    if (!this.hasImputaciones(m)) return;
    this.expandedPaymentId = this.expandedPaymentId === m.id ? null : m.id;
    this.cdr.markForCheck();
  }

  isExpanded(m: CustomerAccountMovement): boolean {
    return this.expandedPaymentId === m.id;
  }

  hasImputaciones(m: CustomerAccountMovement): boolean {
    return (m.imputaciones?.length ?? 0) > 0 || (m.sobrante ?? 0) > 0;
  }

  ventaLabel(i: CustomerPaymentImputacion): string {
    return i.code;
  }

  // ── Detalle de venta (modal read-only) ─────────────────────
  openDetalle(m: CustomerAccountMovement): void {
    if (m.type !== 'venta') return;
    this.detalleModalOpen = true;
    this.detalleModalSale = null;
    this.detalleLoading = true;
    this.saleService.getSaleById(m.id).subscribe({
      next: sale => { this.detalleModalSale = sale; this.detalleLoading = false; this.cdr.markForCheck(); },
      error: () => {
        this.toast.error('No se pudo cargar el detalle de la venta');
        this.detalleLoading = false;
        this.detalleModalOpen = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeDetalle(): void {
    this.detalleModalOpen = false;
    this.detalleModalSale = null;
  }

  // Remito de traslado (sin importes) desde el detalle de la venta CC.
  async descargarRemitoTraslado(): Promise<void> {
    const sale = this.detalleModalSale;
    if (!sale) return;
    if (!sale.details?.length) {
      this.toast.error('La venta no tiene items para el remito.');
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
        }))
      },
      {
        branchName: this.branches.find(b => b.id === sale.branchId)?.name ?? 'Sucursal',
        statusLabel: this.detalleStatusLabel
      },
      false
    );
  }

  get detalleHasDiscount(): boolean {
    return (this.detalleModalSale?.details ?? []).some(d => d.discountPercent > 0);
  }

  get detalleStatusLabel(): string {
    const sale = this.detalleModalSale;
    if (!sale) return '';
    if (sale.idSaleStatus === 3) return 'Cancelada';
    if (sale.idSaleStatus === 2) return 'Pagada';
    const paid = sale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < sale.totalAmount) return 'Pago parcial';
    return 'En espera';
  }

  get detalleStatusClass(): string {
    const sale = this.detalleModalSale;
    if (!sale) return '';
    if (sale.idSaleStatus === 3) return 'badge--cancelled';
    if (sale.idSaleStatus === 2) return 'badge--paid';
    const paid = sale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < sale.totalAmount) return 'badge--partial';
    return 'badge--pending';
  }

  private resetPaymentForm(): void {
    this.newMethod = 1;
    this.newAmount = 0;
    this.newDate = this.todayIso();
    this.newReference = '';
    this.newNotes = '';
    this.newCardBankId = null;
    this.newCardCuotas = null;
    this.newCheque = this.emptyCheque();
  }

  private emptyCheque(): AddCustomerPaymentCheque {
    return {
      bankId: 0,
      numero: '',
      titular: '',
      cuitDni: '',
      monto: 0,
      fechaEmision: this.todayIso(),
      fechaVencimiento: this.todayIso(),
      notas: ''
    };
  }

  // legacy/cancelled markers
  isActiveMovement(m: CustomerAccountMovement): boolean {
    return m.status === 1;
  }

  statusChipClass(m: CustomerAccountMovement): string {
    if (m.status === 3) return 'chip--muted';      // cancelada
    if (m.status === 2) return m.type === 'venta' ? 'chip--success' : 'chip--muted'; // pagada / anulado
    return 'chip--warning';
  }

  statusLabel(m: CustomerAccountMovement): string {
    if (m.type === 'venta') {
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
