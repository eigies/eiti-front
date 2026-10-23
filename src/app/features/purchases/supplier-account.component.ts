import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupplierAccountService } from '../../core/services/supplier-account.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { CreateCreditNoteRequest } from '../../core/models/credit-note.models';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierAccount, SupplierAccountMovement } from '../../core/models/supplier-account.models';
import {
  AccountLedger,
  GroupedPaymentSubmit,
  LedgerQuery,
  LedgerRow,
  PendingDocument,
  SUPPLIER_LEDGER_LABELS
} from '../../core/models/account-ledger.models';
import { CarteraChequeOption } from '../../core/models/cheque.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { AccountLedgerComponent } from '../../shared/components/account-ledger/account-ledger.component';
import { GroupedPaymentModalComponent } from '../../shared/components/grouped-payment-modal/grouped-payment-modal.component';
import { PaymentReceiptPdfService } from '../../shared/services/payment-receipt-pdf.service';
import { meansDetail } from '../../shared/utils/ledger-format.util';

@Component({
  selector: 'app-supplier-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent, AccountLedgerComponent, GroupedPaymentModalComponent],
  templateUrl: './supplier-account.component.html',
  styleUrls: ['./purchase-detail.component.css', './supplier-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierAccountComponent implements OnInit {
  supplierId = '';
  account: SupplierAccount | null = null;
  loading = true;

  readonly permissionCodes = PermissionCodes;

  // ── Extracto ──
  readonly ledgerLabels = SUPPLIER_LEDGER_LABELS;
  ledger: AccountLedger | null = null;
  ledgerLoading = false;
  ledgerQuery: LedgerQuery = { dateFrom: null, dateTo: null, includeCancelled: false };
  busyRowId: string | null = null;

  // ── Pago con varios medios ──
  paymentOpen = false;
  paymentTarget: number | null = null;
  submittingPayment = false;
  carteraCheques: CarteraChequeOption[] = [];
  carteraLoading = false;

  constructor(
    private readonly supplierAccountService: SupplierAccountService,
    readonly auth: AuthService,
    private readonly purchaseService: PurchaseService,
    private readonly paymentReceiptPdf: PaymentReceiptPdfService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('supplierId') ?? '';
    this.load();
  }

  /** Tarjetas de resumen + extracto. Se recarga todo después de cada pago, anulación o nota. */
  load(): void {
    this.supplierAccountService.getAccount(this.supplierId).subscribe({
      next: account => { this.account = account; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar la cuenta del proveedor'); this.loading = false; this.cdr.markForCheck(); }
    });
    this.loadLedger();
  }

  loadLedger(): void {
    this.ledgerLoading = true;
    this.supplierAccountService.getLedger(this.supplierId, this.ledgerQuery).subscribe({
      next: ledger => { this.ledger = ledger; this.ledgerLoading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar el extracto'); this.ledgerLoading = false; this.cdr.markForCheck(); }
    });
  }

  onLedgerQueryChange(query: LedgerQuery): void {
    this.ledgerQuery = query;
    this.loadLedger();
  }

  get compras(): SupplierAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'compra');
  }

  get pagos(): SupplierAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'pago');
  }

  // ── Compras ────────────────────────────────────────────────
  goToCompra(id: string): void {
    this.router.navigate(['/purchases', id]);
  }

  addCompra(): void {
    this.router.navigate(['/purchases/new'], { queryParams: { supplierId: this.supplierId } });
  }

  // ── Pago con varios medios (orden de pago) ─────────────────
  openPayment(selected?: PendingDocument[]): void {
    this.paymentTarget = selected?.length ? selected.reduce((sum, p) => sum + p.pending, 0) : null;
    this.paymentOpen = true;
    this.loadCarteraCheques();
    this.cdr.markForCheck();
  }

  closePayment(): void {
    this.paymentOpen = false;
    this.cdr.markForCheck();
  }

  private loadCarteraCheques(): void {
    this.carteraLoading = true;
    this.purchaseService.listCarteraCheques().subscribe({
      next: cheques => { this.carteraCheques = cheques; this.carteraLoading = false; this.cdr.markForCheck(); },
      error: () => {
        this.carteraCheques = [];
        this.carteraLoading = false;
        this.toast.error('No se pudieron cargar los cheques de cartera');
        this.cdr.markForCheck();
      }
    });
  }

  submitPaymentOrder(payment: GroupedPaymentSubmit): void {
    this.submittingPayment = true;
    this.supplierAccountService.createPaymentOrder(this.supplierId, {
      date: payment.date,
      notes: payment.notes,
      lines: payment.lines.map(l => ({ method: l.method, amount: l.amount, chequeId: l.chequeId, reference: l.reference }))
    }).subscribe({
      next: res => {
        this.submittingPayment = false;
        this.paymentOpen = false;
        const imputadas = (res.imputaciones ?? []).map(i => `${i.code} $${this.formatCurrency(i.amount)}`).join(', ');
        const favor = res.creditAdded > 0 ? ` Saldo a favor: +$${this.formatCurrency(res.creditAdded)}.` : '';
        this.toast.success(`${res.code} registrada por $${this.formatCurrency(res.totalAmount)}.${imputadas ? ' Imputada a: ' + imputadas + '.' : ''}${favor}`);
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.submittingPayment = false;
        this.toast.error(err?.error?.detail || 'No se pudo registrar el pago');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Acciones del extracto ──────────────────────────────────
  async cancelRow(row: LedgerRow): Promise<void> {
    if (row.source === 'credit_note') {
      await this.cancelCreditNote(row);
      return;
    }

    const facturas = row.imputations.map(i => i.code).join(', ');
    const cheques = row.means.filter(m => m.method === 'check').length;
    const detail = [
      facturas ? `Vuelven a pendiente: ${facturas}.` : 'No había facturas imputadas: se revierte el saldo a favor.',
      cheques > 0 ? `${cheques === 1 ? 'El cheque vuelve' : `Los ${cheques} cheques vuelven`} a cartera.` : '',
      row.means.some(m => m.method === 'cash') ? 'El efectivo vuelve a la caja.' : ''
    ].filter(Boolean).join(' ');

    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de proveedor',
      title: row.code ? `Anular ${row.code}` : 'Anular pago',
      message: `Se anulará el pago de $${this.formatCurrency(row.credit)}${row.means.length > 1 ? ` (${row.means.length} medios)` : ''}.`,
      detail,
      confirmLabel: 'Anular pago',
      tone: 'danger'
    });
    if (!confirmed) return;

    const request = row.source === 'payment_order'
      ? this.supplierAccountService.cancelPaymentOrder(this.supplierId, row.id)
      : this.supplierAccountService.cancelPayment(this.supplierId, row.id);

    this.busyRowId = row.id;
    this.cdr.markForCheck();
    request.subscribe({
      next: () => { this.busyRowId = null; this.toast.success(`${row.code ?? 'Pago'} anulado`); this.load(); },
      error: (err: { error?: { detail?: string } }) => {
        this.busyRowId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular el pago');
        this.cdr.markForCheck();
      }
    });
  }

  printRow(row: LedgerRow): void {
    const single = row.means.length === 1 ? row.means[0] : null;
    this.paymentReceiptPdf.generate({
      kind: 'pago',
      partyLabel: 'Proveedor',
      partyName: this.account?.supplierName ?? '-',
      amount: row.credit,
      date: row.date,
      methodLabel: single?.methodLabel ?? 'Varios',
      reference: single?.reference,
      chequeNumero: single?.chequeNumber,
      documentCode: row.code,
      means: row.means.map(m => ({ label: m.methodLabel, detail: meansDetail(m), amount: m.amount })),
      coverage: row.imputations.map(i => ({
        code: i.document ? `${i.code} (Fact. ${i.document})` : i.code,
        amount: i.amount
      })),
      creditAdded: Math.max(0, row.credit - row.imputations.reduce((sum, i) => sum + i.amount, 0))
    }).catch(() => this.toast.error('No se pudo generar el comprobante'));
  }

  // ── Notas de crédito ──
  showCreditNoteForm = false;
  addingCreditNote = false;
  ncAmount = 0;
  ncReason = '';
  ncDate = '';
  ncPurchaseId: string | null = null;

  /** Compras a las que se puede asociar la NC: las de este proveedor que no estén anuladas. */
  get creditNotePurchaseOptions(): SearchableSelectOption[] {
    return [
      { value: '', label: 'Sin compra asociada' },
      ...this.compras
        .filter(c => c.status !== 3)
        .map(c => ({ value: c.id, label: `${c.code || 'S/N'} · $${this.formatCurrency(c.amount)}` }))
    ];
  }

  get canSubmitCreditNote(): boolean {
    return !this.addingCreditNote
      && this.ncAmount > 0
      && this.ncReason.trim().length > 0
      && !!this.ncDate;
  }

  toggleCreditNoteForm(): void {
    this.showCreditNoteForm = !this.showCreditNoteForm;
    if (this.showCreditNoteForm) this.resetCreditNoteForm();
    this.cdr.markForCheck();
  }

  submitCreditNote(): void {
    if (!this.canSubmitCreditNote) return;

    const payload: CreateCreditNoteRequest = {
      amount: this.ncAmount,
      reason: this.ncReason.trim(),
      date: this.ncDate,
      purchaseId: this.ncPurchaseId || null
    };

    this.addingCreditNote = true;
    this.supplierAccountService.createCreditNote(this.supplierId, payload).subscribe({
      next: result => {
        this.addingCreditNote = false;
        this.showCreditNoteForm = false;
        this.toast.success(`Nota de crédito ${result.code} registrada`);
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.addingCreditNote = false;
        this.toast.error(err?.error?.detail || 'No se pudo registrar la nota de crédito');
        this.cdr.markForCheck();
      }
    });
  }

  private async cancelCreditNote(row: LedgerRow): Promise<void> {
    // Si el crédito ya se imputó, anular la NC deja esas compras impagas otra vez.
    const compras = row.imputations.map(i => i.code).join(', ');
    const detail = compras
      ? `Vuelven a quedar pendientes: ${compras}.`
      : 'El saldo a favor generado por esta nota vuelve atrás.';

    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de proveedor',
      title: 'Anular nota de crédito',
      message: `Se anulará la nota de crédito ${row.code} de $${this.formatCurrency(row.credit)}.`,
      detail,
      confirmLabel: 'Anular nota',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.busyRowId = row.id;
    this.cdr.markForCheck();
    this.supplierAccountService.cancelCreditNote(this.supplierId, row.id).subscribe({
      next: () => {
        this.busyRowId = null;
        this.toast.success('Nota de crédito anulada');
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.busyRowId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular la nota de crédito');
        this.cdr.markForCheck();
      }
    });
  }

  private resetCreditNoteForm(): void {
    this.ncAmount = 0;
    this.ncReason = '';
    this.ncDate = this.todayIso();
    this.ncPurchaseId = null;
  }

  formatCurrency(value: number): string {
    return formatMoney(value);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA');
  }
}
