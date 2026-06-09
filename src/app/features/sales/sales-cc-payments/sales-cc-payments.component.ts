import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { CashService } from '../../../core/services/cash.service';
import { BankService } from '../../../core/services/bank.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SaleByIdResponse, CcPaymentResponse, AddCcPaymentGroupRequest, AddCcPaymentGroupResponse } from '../../../core/models/sale.models';
import { CashDrawerResponse } from '../../../core/models/cash.models';
import { BankResponse } from '../../../core/models/bank.models';
import {
  SALE_PAYMENT_METHODS,
  SalePaymentMethodOption,
  SalePaymentDraftState,
  createEmptySalePaymentDraftState,
  normalizeSalePayments
} from '../../../core/models/sale-payment.models';
import { SalePaymentInlineComponent } from '../../../shared/components/sale-payment-inline/sale-payment-inline.component';
import { PermissionCodes } from '../../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../../shared/services/confirmation.service';

interface PaymentGroup {
  groupId: string | null;
  payments: CcPaymentResponse[];
  totalAmount: number;
  date: string;
  notes: string | null;
  status: number;
}

@Component({
  selector: 'app-sales-cc-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SalePaymentInlineComponent, SearchableSelectComponent],
  templateUrl: './sales-cc-payments.component.html',
  styleUrls: ['./sales-cc-payments.component.css']
})
export class SalesCcPaymentsComponent implements OnInit {
  readonly paymentMethods: SalePaymentMethodOption[] = SALE_PAYMENT_METHODS;
  saleId = '';
  sale: SaleByIdResponse | null = null;
  payments: CcPaymentResponse[] = [];
  loading = true;
  addingPayment = false;
  cancellingGroupId: string | null = null;
  cancellingPaymentId: string | null = null;
  cancellingSale = false;
  readonly permissionCodes = PermissionCodes;

  cashDrawers: CashDrawerResponse[] = [];
  selectedCashDrawerId = '';
  banks: BankResponse[] = [];

  paymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
  paymentForm!: FormGroup;

  constructor(
    private readonly saleService: SaleService,
    private readonly cashService: CashService,
    private readonly bankService: BankService,
    readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.saleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.paymentForm = this.fb.group({
      date: [this.todayIso(), [Validators.required]],
      notes: ['']
    });
    this.bankService.listBanks(true).subscribe({
      next: banks => this.banks = banks,
      error: () => {} // non-blocking — payment still works without bank data
    });
    this.reload();
  }

  get remaining(): number {
    return this.sale?.ccPendingAmount ?? 0;
  }

  get canSubmitPayment(): boolean {
    const lines = normalizeSalePayments(this.paymentState);
    return !this.addingPayment
      && this.paymentForm?.valid
      && lines.length > 0
      && lines.some(l => l.amount > 0)
      && !!this.selectedCashDrawerId;
  }

  get overpaymentAmount(): number {
    const lines = normalizeSalePayments(this.paymentState);
    const coverage = lines.reduce((sum, l) => sum + Number(l.amount), 0);
    const excess = coverage - (this.remaining ?? 0);
    return excess > 0 ? excess : 0;
  }

  get statusLabel(): string {
    if (!this.sale) return '';
    if (this.sale.idSaleStatus === 3) return 'Cancelada';
    if (this.sale.idSaleStatus === 2) return 'Pagada';
    const paid = this.sale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < this.sale.totalAmount) return 'Pago parcial';
    return 'En espera';
  }

  get statusClass(): string {
    if (!this.sale) return '';
    if (this.sale.idSaleStatus === 3) return 'badge--cancelled';
    if (this.sale.idSaleStatus === 2) return 'badge--paid';
    const paid = this.sale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < this.sale.totalAmount) return 'badge--partial';
    return 'badge--pending';
  }

  get cashDrawerOptions(): SearchableSelectOption[] {
    return this.cashDrawers.map(drawer => ({
      value: drawer.id,
      label: drawer.name
    }));
  }

  get groupedPayments(): PaymentGroup[] {
    const groups = new Map<string, CcPaymentResponse[]>();
    const ungrouped: CcPaymentResponse[] = [];

    for (const p of this.payments) {
      if (p.groupId) {
        const existing = groups.get(p.groupId) ?? [];
        existing.push(p);
        groups.set(p.groupId, existing);
      } else {
        ungrouped.push(p);
      }
    }

    const result: PaymentGroup[] = [];

    for (const [groupId, items] of groups) {
      result.push({
        groupId,
        payments: items,
        totalAmount: items.reduce((s, i) => s + i.amount, 0),
        date: items[0].date,
        notes: items[0].notes ?? null,
        status: items[0].status
      });
    }

    for (const p of ungrouped) {
      result.push({
        groupId: null,
        payments: [p],
        totalAmount: p.amount,
        date: p.date,
        notes: p.notes ?? null,
        status: p.status
      });
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  paymentMethodLabel(id: number): string {
    if (id === 6) return 'Saldo a favor';
    return this.paymentMethods.find(m => m.id === id)?.label ?? 'Otro';
  }

  reload(): void {
    this.loading = true;
    this.saleService.getSaleById(this.saleId).subscribe({
      next: sale => {
        this.sale = sale;
        this.loading = false;
        if (sale.branchId && this.cashDrawers.length === 0) {
          this.loadDrawers(sale.branchId);
        }
      },
      error: () => {
        this.toast.error('No se pudo cargar la venta');
        this.loading = false;
      }
    });
    this.saleService.listCcPayments(this.saleId).subscribe({
      next: payments => this.payments = payments,
      error: () => this.toast.error('No se pudieron cargar los pagos')
    });
  }

  private loadDrawers(branchId: string): void {
    this.cashService.listCashDrawers(branchId).subscribe({
      next: drawers => {
        const assignedId = this.auth.currentUser?.assignedCashDrawerId ?? null;
        const canViewAllDrawers = this.auth.hasPermission(PermissionCodes.cashDrawerViewAll);
        this.cashDrawers = drawers
          .filter(d => d.isActive && d.hasOpenSession)
          .filter(d => canViewAllDrawers || !assignedId || d.id === assignedId);
        if (this.cashDrawers.length === 1) {
          this.selectedCashDrawerId = this.cashDrawers[0].id;
        } else if (assignedId && this.cashDrawers.some(d => d.id === assignedId)) {
          this.selectedCashDrawerId = assignedId;
        }
      },
      error: () => this.toast.error('No se pudieron cargar las cajas')
    });
  }

  submitPayment(): void {
    if (!this.canSubmitPayment) return;
    this.addingPayment = true;

    const validLines = normalizeSalePayments(this.paymentState);
    const val = this.paymentForm.value;
    const request: AddCcPaymentGroupRequest = {
      methods: validLines.map(l => ({
        idPaymentMethod: l.idPaymentMethod,
        amount: l.amount,
        cardBankId: l.cardBankId ?? undefined,
        cardCuotas: l.cardCuotas ?? undefined,
        cheque: l.cheque ? {
          numero: l.cheque.numero,
          bankId: l.cheque.bankId,
          titular: l.cheque.titular,
          cuitDni: l.cheque.cuitDni,
          monto: l.cheque.monto,
          fechaEmision: l.cheque.fechaEmision,
          fechaVencimiento: l.cheque.fechaVencimiento,
          notas: l.cheque.notas ?? null
        } : undefined
      })),
      date: val.date,
      notes: val.notes || null,
      cashDrawerId: this.selectedCashDrawerId
    };

    this.saleService.addCcPaymentGroup(this.saleId, request).subscribe({
      next: (res: AddCcPaymentGroupResponse) => {
        this.addingPayment = false;
        this.toast.success('Pago registrado');
        this.paymentState = createEmptySalePaymentDraftState();
        this.paymentForm.patchValue({ notes: '' });
        this.reload();
        if (res?.creditAdded && res.creditAdded > 0) {
          const added = res.creditAdded.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const balance = res.newCustomerCreditBalance?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) ?? '0,00';
          this.toast.success(`Se acreditaron $${added} como saldo a favor. Nuevo saldo: $${balance}`);
        }
      },
      error: (err: unknown) => {
        this.addingPayment = false;
        const e = err as { error?: { detail?: string; message?: string } };
        this.toast.error(e?.error?.detail || e?.error?.message || 'Error al registrar el pago');
      }
    });
  }

  async requestCancel(group: PaymentGroup): Promise<void> {
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta corriente',
      title: 'Anular pago',
      message: 'El pago dejara de computarse en el saldo de esta venta.',
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Anular pago',
      tone: 'danger'
    });
    if (!confirmed) return;

    const paymentId = group.payments[0].id;
    if (group.groupId) {
      this.cancellingGroupId = group.groupId;
    } else {
      this.cancellingPaymentId = paymentId;
    }

    this.saleService.cancelCcPayment(this.saleId, paymentId).subscribe({
      next: () => {
        this.cancellingGroupId = null;
        this.cancellingPaymentId = null;
        this.toast.success('Pago anulado');
        this.reload();
      },
      error: () => {
        this.cancellingGroupId = null;
        this.cancellingPaymentId = null;
        this.toast.error('Error al anular el pago');
      }
    });
  }

  isCancellingGroup(group: PaymentGroup): boolean {
    if (group.groupId) return this.cancellingGroupId === group.groupId;
    return this.cancellingPaymentId === group.payments[0]?.id;
  }

  async cancelSale(): Promise<void> {
    if (!this.sale) return;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta corriente',
      title: 'Anular venta',
      message: `Vas a anular la venta ${this.sale.code || 'seleccionada'}.`,
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Anular venta',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.cancellingSale = true;
    this.saleService.cancelSale(this.saleId).subscribe({
      next: () => {
        this.cancellingSale = false;
        this.toast.success('Venta anulada');
        this.router.navigate(['/sales']);
      },
      error: (err) => {
        this.cancellingSale = false;
        this.toast.error(err?.error?.detail || 'No se pudo anular la venta');
      }
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
