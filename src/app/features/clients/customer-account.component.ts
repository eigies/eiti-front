import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CustomerAccountService } from '../../core/services/customer-account.service';
import { CreateCreditNoteRequest } from '../../core/models/credit-note.models';
import { BankService } from '../../core/services/bank.service';
import { BranchService } from '../../core/services/branch.service';
import { SaleService } from '../../core/services/sale.service';
import { AuthService } from '../../core/services/auth.service';
import { RemitoPdfService } from '../../shared/services/remito-pdf.service';
import { PaymentReceiptPdfService, PaymentReceiptData } from '../../shared/services/payment-receipt-pdf.service';
import { SALE_PAYMENT_METHODS } from '../../core/models/sale-payment.models';
import { CustomerAccount, CustomerAccountMovement } from '../../core/models/customer-account.models';
import {
  AccountLedger,
  CUSTOMER_LEDGER_LABELS,
  GroupedPaymentSubmit,
  LedgerQuery,
  LedgerRow,
  PendingDocument
} from '../../core/models/account-ledger.models';
import { BankResponse } from '../../core/models/bank.models';
import { cancelInvoicingNotice, CancelInvoicingNotice, SaleByIdResponse, SaleFiscalDocumentKind } from '../../core/models/sale.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { SaleFiscalPdfService } from '../../shared/services/sale-fiscal-pdf.service';
import { SaleNotesComponent } from '../../shared/components/sale-notes/sale-notes.component';
import { creditNoteReceiverConfirmation, isInvoiceReceiverChanged } from '../../shared/utils/fiscal-receivers.util';
import { canDownloadSaleCreditNote, canDownloadSaleDebitNote, canDownloadSaleInvoice } from '../../shared/utils/sale-fiscal-documents.util';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { AccountLedgerComponent } from '../../shared/components/account-ledger/account-ledger.component';
import { GroupedPaymentModalComponent } from '../../shared/components/grouped-payment-modal/grouped-payment-modal.component';
import { meansDetail } from '../../shared/utils/ledger-format.util';

@Component({
  selector: 'app-customer-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent, AccountLedgerComponent, GroupedPaymentModalComponent, SaleNotesComponent],
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
  cancelingSale = false;

  // Nota de crédito
  showCreditNoteForm = false;
  addingCreditNote = false;
  ncAmount = 0;
  ncReason = '';
  ncDate = '';
  ncSaleId: string | null = null;

  // Extracto
  readonly ledgerLabels = CUSTOMER_LEDGER_LABELS;
  ledger: AccountLedger | null = null;
  ledgerLoading = false;
  ledgerQuery: LedgerQuery = { dateFrom: null, dateTo: null, includeCancelled: false };
  busyRowId: string | null = null;

  // Cobro con varios medios (recibo)
  paymentOpen = false;
  paymentTarget: number | null = null;
  submittingPayment = false;

  banks: BankResponse[] = [];
  banksLoading = true;
  branches: { id: string; name: string }[] = [];

  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly bankService: BankService,
    private readonly branchService: BranchService,
    private readonly saleService: SaleService,
    private readonly remitoPdf: RemitoPdfService,
    private readonly paymentReceiptPdf: PaymentReceiptPdfService,
    readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService,
    private readonly saleFiscalPdf: SaleFiscalPdfService
  ) {}

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? '';
    this.bankService.listBanks(true, 'all').subscribe({
      next: banks => { this.banks = banks; this.banksLoading = false; this.cdr.markForCheck(); },
      // No bloquea: el cobro funciona sin datos de banco (las opciones de banco quedan vacías).
      error: () => { this.banksLoading = false; this.cdr.markForCheck(); }
    });
    this.branchService.listBranches().subscribe({
      next: branches => { this.branches = branches.map(b => ({ id: b.id, name: b.name })); this.cdr.markForCheck(); },
      error: () => {} // non-blocking — el remito sale igual con sucursal genérica
    });
    this.load();
  }

  /** Tarjetas de resumen + extracto. Se recarga todo después de cada cobro, anulación o nota. */
  load(): void {
    this.customerAccountService.getAccount(this.customerId).subscribe({
      next: account => { this.account = account; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar la cuenta del cliente'); this.loading = false; this.cdr.markForCheck(); }
    });
    this.loadLedger();
  }

  loadLedger(): void {
    this.ledgerLoading = true;
    this.customerAccountService.getLedger(this.customerId, this.ledgerQuery).subscribe({
      next: ledger => { this.ledger = ledger; this.ledgerLoading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar el extracto'); this.ledgerLoading = false; this.cdr.markForCheck(); }
    });
  }

  onLedgerQueryChange(query: LedgerQuery): void {
    this.ledgerQuery = query;
    this.loadLedger();
  }

  get ventas(): CustomerAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'venta');
  }

  get cobros(): CustomerAccountMovement[] {
    return (this.account?.movements ?? []).filter(m => m.type === 'cobro');
  }

  /** Ventas a las que se puede asociar la NC: las del cliente que no estén anuladas. */
  get creditNoteSaleOptions(): SearchableSelectOption[] {
    return [
      { value: '', label: 'Sin venta asociada' },
      ...this.ventas
        .filter(v => v.status !== 3)
        .map(v => ({ value: v.id, label: `${v.code || 'S/N'} · $${this.formatCurrency(v.amount)}` }))
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
      saleId: this.ncSaleId || null
    };

    this.addingCreditNote = true;
    this.customerAccountService.createCreditNote(this.customerId, payload).subscribe({
      next: result => {
        this.addingCreditNote = false;
        this.showCreditNoteForm = false;
        this.toast.success(`Nota de crédito ${result.code} emitida`);
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.addingCreditNote = false;
        this.toast.error(err?.error?.detail || 'No se pudo emitir la nota de crédito');
        this.cdr.markForCheck();
      }
    });
  }

  private async cancelCreditNote(row: LedgerRow): Promise<void> {
    // Si el crédito ya se imputó, anular la NC deja esas ventas impagas otra vez.
    // El usuario tiene que verlo antes de confirmar.
    const ventas = row.imputations.map(i => i.code).join(', ');
    const detail = ventas
      ? `Vuelven a quedar pendientes: ${ventas}.`
      : 'El saldo a favor generado por esta nota vuelve atrás.';

    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de cliente',
      title: 'Anular nota de crédito',
      message: `Se anulará la nota de crédito ${row.code} de $${this.formatCurrency(row.credit)}.`,
      detail,
      confirmLabel: 'Anular nota',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.busyRowId = row.id;
    this.cdr.markForCheck();
    this.customerAccountService.cancelCreditNote(this.customerId, row.id).subscribe({
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
    this.ncSaleId = null;
  }

  // ── Cobro con varios medios (recibo) ───────────────────────
  openPayment(selected?: PendingDocument[]): void {
    this.paymentTarget = selected?.length ? selected.reduce((sum, p) => sum + p.pending, 0) : null;
    this.paymentOpen = true;
    this.cdr.markForCheck();
  }

  closePayment(): void {
    this.paymentOpen = false;
    this.cdr.markForCheck();
  }

  submitReceipt(payment: GroupedPaymentSubmit): void {
    this.submittingPayment = true;
    this.customerAccountService.createReceipt(this.customerId, {
      date: payment.date,
      notes: payment.notes,
      lines: payment.lines.map(l => ({
        method: l.method,
        amount: l.amount,
        reference: l.reference,
        cardBankId: l.cardBankId,
        cardCuotas: l.cardCuotas,
        transferBankId: l.transferBankId,
        cheque: l.cheque
      }))
    }).subscribe({
      next: res => {
        this.submittingPayment = false;
        this.paymentOpen = false;
        const imputadas = (res.imputaciones ?? []).map(i => `${i.code} $${this.formatCurrency(i.amount)}`).join(', ');
        const favor = res.creditAdded > 0 ? ` Saldo a favor: +$${this.formatCurrency(res.creditAdded)}.` : '';
        this.toast.success(`${res.code} registrado por $${this.formatCurrency(res.totalAmount)}.${imputadas ? ' Imputado a: ' + imputadas + '.' : ''}${favor}`);
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.submittingPayment = false;
        this.toast.error(err?.error?.detail || 'No se pudo registrar el cobro');
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

    const ventas = row.imputations.map(i => i.code).join(', ');
    const cheques = row.means.filter(m => m.method === 'check').length;
    const detail = [
      ventas ? `Vuelven a pendiente: ${ventas}.` : 'No había ventas imputadas: se revierte el saldo a favor.',
      cheques > 0 ? `${cheques === 1 ? 'El cheque recibido se anula' : `Los ${cheques} cheques recibidos se anulan`}.` : '',
      row.means.some(m => m.method === 'cash') ? 'El efectivo sale de la caja.' : ''
    ].filter(Boolean).join(' ');

    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta de cliente',
      title: row.code ? `Anular ${row.code}` : 'Anular cobro',
      message: `Se anulará el cobro de $${this.formatCurrency(row.credit)}${row.means.length > 1 ? ` (${row.means.length} medios)` : ''}.`,
      detail,
      confirmLabel: 'Anular cobro',
      tone: 'danger'
    });
    if (!confirmed) return;

    const request = row.source === 'receipt'
      ? this.customerAccountService.cancelReceipt(this.customerId, row.id)
      : this.customerAccountService.cancelPayment(this.customerId, row.id);

    this.busyRowId = row.id;
    this.cdr.markForCheck();
    request.subscribe({
      next: () => { this.busyRowId = null; this.toast.success(`${row.code ?? 'Cobro'} anulado`); this.load(); },
      error: (err: { error?: { detail?: string } }) => {
        this.busyRowId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular el cobro');
        this.cdr.markForCheck();
      }
    });
  }

  /** Recibo en PDF con sus medios y el detalle de las ventas que cubrió. */
  printRow(row: LedgerRow): void {
    const single = row.means.length === 1 ? row.means[0] : null;
    const data: PaymentReceiptData = {
      kind: 'cobro',
      partyLabel: 'Cliente',
      partyName: this.account?.customerName ?? '-',
      amount: row.credit,
      date: row.date,
      methodLabel: single?.methodLabel ?? 'Varios',
      reference: single?.reference,
      chequeNumero: single?.chequeNumber,
      documentCode: row.code,
      means: row.means.map(m => ({ label: m.methodLabel, detail: meansDetail(m), amount: m.amount })),
      coverage: row.imputations.map(i => ({ code: i.code, amount: i.amount })),
      creditAdded: Math.max(0, row.credit - row.imputations.reduce((sum, i) => sum + i.amount, 0))
    };

    if (row.imputations.length === 0) {
      this.paymentReceiptPdf.generate(data).catch(() => this.toast.error('No se pudo generar el recibo'));
      return;
    }

    forkJoin(row.imputations.map(i => this.saleService.getSaleById(i.documentId))).subscribe({
      next: sales => {
        data.saleDetailSections = sales.map((sale, index) => ({
          code: sale.code || row.imputations[index]?.code || 'S/N',
          details: sale.details.map(detail => ({
            productBrand: detail.productBrand,
            productName: detail.productName,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
            totalAmount: detail.totalAmount
          }))
        }));
        this.paymentReceiptPdf.generate(data).catch(() => this.toast.error('No se pudo generar el recibo'));
      },
      error: () => this.toast.error('No se pudo cargar el detalle de las ventas para el recibo')
    });
  }

  // Descarga TODOS los recibos de pagos activos de la venta abierta en el modal de detalle.
  downloadAllSaleReceipts(): void {
    const sale = this.detalleModalSale;
    if (!sale) { return; }
    const activePayments = (sale.ccPayments ?? []).filter(p => p.status === 1);
    if (activePayments.length === 0) {
      this.toast.error('No hay pagos activos para generar recibos');
      return;
    }
    const receipts: PaymentReceiptData[] = activePayments.map(p => ({
      kind: 'cobro',
      partyLabel: 'Cliente',
      partyName: sale.customerFullName || 'Sin cliente',
      amount: p.amount,
      date: p.date,
      methodLabel: SALE_PAYMENT_METHODS.find(m => m.id === p.idPaymentMethod)?.label ?? 'Otro',
      notes: p.notes,
      coverage: [{ code: sale.code || 'S/N', amount: p.amount }],
      saleDetailSections: [{
        code: sale.code || 'S/N',
        details: sale.details.map(detail => ({
          productBrand: detail.productBrand,
          productName: detail.productName,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          totalAmount: detail.totalAmount
        }))
      }]
    }));
    this.paymentReceiptPdf.generateBatch(receipts, `recibos-${sale.code || sale.id}.pdf`)
      .catch(() => this.toast.error('No se pudieron generar los recibos'));
  }

  // ── Detalle de venta (modal read-only) ─────────────────────
  openDetalle(saleId: string): void {
    this.detalleModalOpen = true;
    this.detalleModalSale = null;
    this.detalleLoading = true;
    this.saleService.getSaleById(saleId).subscribe({
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
    if (this.cancelingSale) return;
    this.detalleModalOpen = false;
    this.detalleModalSale = null;
  }

  // Modal de anulación de venta (con elección de qué hacer con los cobros).
  cancelModalOpen = false;
  cancelRefundMode = 1; // 1 = saldo a favor, 2 = anular pagos

  // Solo ventas pendientes (1) o pagadas (2) y con permiso de anulación.
  /** Las observaciones se corrigen con la venta en cualquier estado salvo anulada (no son dato fiscal). */
  get canEditDetalleNotes(): boolean {
    const sale = this.detalleModalSale;
    return !!sale && sale.idSaleStatus !== 3 && this.auth.hasPermission(PermissionCodes.salesUpdate);
  }

  onDetalleNotesSaved(notes: string | null): void {
    if (this.detalleModalSale) {
      this.detalleModalSale = { ...this.detalleModalSale, notes };
    }
  }

  get canCancelDetalleSale(): boolean {
    const sale = this.detalleModalSale;
    return !!sale
      && (sale.idSaleStatus === 1 || sale.idSaleStatus === 2)
      && this.auth.hasPermission(PermissionCodes.salesDelete);
  }

  // Monto ya cobrado de la venta en detalle (cobros imputados).
  get detalleCcPaidTotal(): number {
    return this.detalleModalSale?.ccPaidTotal ?? 0;
  }

  get detalleHasCobros(): boolean {
    return this.detalleCcPaidTotal > 0;
  }

  /** Aviso fiscal del modal de anular: la NC se emite sola si la venta esta facturada. */
  get cancelInvoicingNotice(): CancelInvoicingNotice | null {
    return this.detalleModalSale ? cancelInvoicingNotice(this.detalleModalSale) : null;
  }

  openCancelModal(): void {
    if (!this.detalleModalSale) return;
    this.cancelRefundMode = 1;
    this.cancelModalOpen = true;
    this.cdr.markForCheck();
  }

  closeCancelModal(): void {
    if (this.cancelingSale) return;
    this.cancelModalOpen = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  closeActiveModal(): void {
    if (this.cancelModalOpen) {
      this.closeCancelModal();
      return;
    }
    if (this.detalleModalOpen) this.closeDetalle();
  }

  setCancelRefundMode(mode: number): void {
    this.cancelRefundMode = mode;
    this.cdr.markForCheck();
  }

  confirmCancelSale(): void {
    const sale = this.detalleModalSale;
    if (!sale || this.cancelingSale) return;
    // Solo manda el modo si hay cobros que resolver.
    const refundMode = this.detalleHasCobros ? this.cancelRefundMode : undefined;
    this.cancelSale(sale, refundMode, false);
  }

  /**
   * Si la factura salio a otro receptor que el de la ficha, el back no anula hasta que el usuario vea los dos
   * CUIT y confirme que la NC vaya al de la factura.
   */
  private cancelSale(sale: SaleByIdResponse, refundMode: number | undefined, confirmInvoiceReceiver: boolean): void {
    this.cancelingSale = true;
    this.cdr.markForCheck();
    this.saleService.cancelSale(sale.id, refundMode, confirmInvoiceReceiver).subscribe({
      next: () => {
        this.cancelingSale = false;
        this.cancelModalOpen = false;
        this.detalleModalOpen = false;
        this.detalleModalSale = null;
        this.toast.success('Venta anulada');
        this.cdr.markForCheck();
        this.load();
      },
      error: (err: { error?: { detail?: string; errorCode?: string } }) => {
        this.cancelingSale = false;
        this.cdr.markForCheck();
        if (!confirmInvoiceReceiver && isInvoiceReceiverChanged(err)) {
          this.askInvoiceReceiver(sale, refundMode);
          return;
        }
        this.toast.error(err?.error?.detail || 'No se pudo anular la venta');
      }
    });
  }

  /** Muestra a quien se emitio la factura contra la ficha actual y anula solo si el usuario confirma. */
  private askInvoiceReceiver(sale: SaleByIdResponse, refundMode: number | undefined): void {
    this.saleService.getFiscalReceivers(sale.id).subscribe({
      next: async receivers => {
        if (!receivers.available || !receivers.invoice) {
          this.toast.error(receivers.unavailableReason ?? 'No se pudo consultar a quién se emitió la factura.');
          return;
        }

        if (await this.confirmation.confirm(creditNoteReceiverConfirmation(receivers, 'cancel'))) {
          this.cancelSale(sale, refundMode, true);
        }
      },
      error: (err: { error?: { detail?: string } }) =>
        this.toast.error(err?.error?.detail ?? 'No se pudo consultar a quién se emitió la factura.')
    });
  }

  // Remito de traslado (sin importes) desde el detalle de la venta CC.
  async descargarRemitoTraslado(): Promise<void> {
    await this.generarRemitoCc(false);
  }

  // Comprobante con precios de la venta CC (mismo remito, con importes). Bajo permiso salesRemitoAmounts.
  async descargarComprobante(): Promise<void> {
    await this.generarRemitoCc(true);
  }

  // Factura, NC y ND de la venta: el mismo PDF fiscal y el mismo permiso que en Gestión de Ventas.
  get canDownloadDetalleInvoice(): boolean {
    return this.canInvoice && canDownloadSaleInvoice(this.detalleModalSale?.invoicingStatus);
  }

  get canDownloadDetalleCreditNote(): boolean {
    return this.canInvoice && canDownloadSaleCreditNote(this.detalleModalSale?.invoicingStatus);
  }

  get canDownloadDetalleDebitNote(): boolean {
    return this.canInvoice && canDownloadSaleDebitNote(this.detalleModalSale?.debitNoteStatus);
  }

  downloadDetalleFiscalPdf(kind: SaleFiscalDocumentKind): void {
    if (!this.detalleModalSale) return;
    this.saleFiscalPdf.download(this.detalleModalSale.id, kind);
  }

  private get canInvoice(): boolean {
    return this.auth.hasPermission(PermissionCodes.salesInvoice);
  }

  private async generarRemitoCc(incluirImportes: boolean): Promise<void> {
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
        customerAddress: sale.customerAddress,
        customerPhone: sale.customerPhone,
        deliveryAddress: sale.deliveryAddress,
        contactPhone: sale.contactPhone,
        hasDelivery: sale.hasDelivery,
        totalAmount: sale.totalAmount,
        details: sale.details.map(d => ({
          productBrand: d.productBrand,
          productName: d.productName,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          totalAmount: d.totalAmount
        })),
        tradeIns: (sale.tradeIns ?? []).map(t => ({
          productBrand: t.productBrand,
          productName: t.productName,
          quantity: t.quantity,
          amount: t.amount
        }))
      },
      {
        branchName: this.branches.find(b => b.id === sale.branchId)?.name ?? 'Sucursal',
        statusLabel: this.detalleStatusLabel,
        paymentSummary: 'Cuenta corriente',
        coveredAmount: this.detalleCcPaidTotal
      },
      incluirImportes
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

  formatCurrency(value: number): string {
    return formatMoney(value);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA');
  }
}
