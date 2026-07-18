import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { PurchaseDetailResponse, PurchasePaymentMethod, PurchaseStatus } from '../../core/models/purchase.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { PaymentReceiptPdfService, PaymentReceiptData } from '../../shared/services/payment-receipt-pdf.service';

const PURCHASE_PAYMENT_METHOD_LABELS: Record<PurchasePaymentMethod, string> = {
  [PurchasePaymentMethod.Cash]: 'Efectivo',
  [PurchasePaymentMethod.BankTransfer]: 'Transferencia',
  [PurchasePaymentMethod.Check]: 'Cheque',
  [PurchasePaymentMethod.Other]: 'Otro',
  [PurchasePaymentMethod.SupplierCredit]: 'Saldo a favor'
};

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['./purchase-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseDetailComponent implements OnInit {
  purchase: PurchaseDetailResponse | null = null;
  loading = true;
  cancelling = false;

  readonly PurchaseStatus = PurchaseStatus;

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentReceiptPdf: PaymentReceiptPdfService,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load(id);
  }

  private load(id: string): void {
    this.loading = true;
    this.purchaseService.getPurchaseById(id).subscribe({
      next: p => { this.purchase = p; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.toast.error('No se pudo cargar la compra'); this.loading = false; this.cdr.markForCheck(); }
    });
  }

  get purchaseId(): string {
    return this.purchase?.id ?? '';
  }

  // Descarga TODOS los recibos de pagos activos imputados a esta compra en un solo PDF.
  downloadAllReceipts(): void {
    const purchase = this.purchase;
    if (!purchase) { return; }
    const activePayments = purchase.payments.filter(p => p.status === 1);
    if (activePayments.length === 0) {
      this.toast.error('No hay pagos activos para generar recibos');
      return;
    }
    const receipts: PaymentReceiptData[] = activePayments.map(p => ({
      kind: 'pago',
      partyLabel: 'Proveedor',
      partyName: purchase.supplierName ?? '-',
      amount: p.amount,
      date: p.date,
      methodLabel: PURCHASE_PAYMENT_METHOD_LABELS[p.method] ?? 'Otro',
      reference: p.reference,
      notes: p.notes,
      chequeNumero: p.chequeNumero,
      coverage: [{ code: purchase.invoiceNumber ? `${purchase.code} (Fact. ${purchase.invoiceNumber})` : purchase.code, amount: p.amount }]
    }));
    this.paymentReceiptPdf.generateBatch(receipts, `recibos-${purchase.code}.pdf`)
      .catch(() => this.toast.error('No se pudieron generar los recibos'));
  }

  backToAccount(): void {
    if (this.purchase?.supplierId) {
      this.router.navigate(['/purchases/supplier', this.purchase.supplierId]);
    } else {
      this.router.navigate(['/purchases']);
    }
  }

  statusLabel(status: PurchaseStatus): string {
    switch (status) {
      case PurchaseStatus.Active: return 'Pendiente';
      case PurchaseStatus.Paid: return 'Pagada';
      case PurchaseStatus.Cancelled: return 'Cancelada';
      default: return 'Desconocido';
    }
  }

  statusChipClass(status: PurchaseStatus): string {
    switch (status) {
      case PurchaseStatus.Active: return 'chip--warning';
      case PurchaseStatus.Paid: return 'chip--success';
      case PurchaseStatus.Cancelled: return 'chip--muted';
      default: return 'chip--muted';
    }
  }

  async cancelPurchase(): Promise<void> {
    if (!this.purchase) return;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Compra a proveedor',
      title: 'Cancelar compra',
      message: `Vas a cancelar la compra ${this.purchase.code || 'seleccionada'}.`,
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Cancelar compra',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.cancelling = true;
    this.purchaseService.cancelPurchase(this.purchaseId).subscribe({
      next: () => { this.toast.success('Compra cancelada'); this.backToAccount(); },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al cancelar la compra');
        this.cancelling = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatCurrency(value: number): string {
    return formatMoney(value);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
