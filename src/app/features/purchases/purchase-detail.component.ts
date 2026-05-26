import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { AddPurchasePaymentRequest, PurchaseDetailResponse, PurchasePayment, PurchasePaymentMethod, PurchaseStatus } from '../../core/models/purchase.models';
import { ToastService } from '../../shared/services/toast.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

const PAYMENT_METHOD_LABELS: Record<number, string> = {
  [PurchasePaymentMethod.Cash]: 'Efectivo',
  [PurchasePaymentMethod.BankTransfer]: 'Transferencia',
  [PurchasePaymentMethod.Check]: 'Cheque',
  [PurchasePaymentMethod.Other]: 'Otro'
};

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['./purchase-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseDetailComponent implements OnInit {
  purchase: PurchaseDetailResponse | null = null;
  loading = true;
  cancelling = false;
  addingPayment = false;
  cancellingPaymentId: string | null = null;

  // Add payment form fields
  newPaymentMethod = 1;
  newPaymentAmount = 0;
  newPaymentDate = '';
  newPaymentReference = '';
  newPaymentNotes = '';

  readonly PurchaseStatus = PurchaseStatus;
  readonly paymentMethods = [
    { value: 1, label: 'Efectivo' },
    { value: 2, label: 'Transferencia' },
    { value: 3, label: 'Cheque' },
    { value: 4, label: 'Otro' }
  ];

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.newPaymentDate = this.todayIso();
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load(id);
  }

  private load(id: string): void {
    this.loading = true;
    this.purchaseService.getPurchaseById(id).subscribe({
      next: p => {
        this.purchase = p;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudo cargar la compra');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get activePayments(): PurchasePayment[] {
    return (this.purchase?.payments ?? []).filter(p => p.status === 1);
  }

  get purchaseId(): string {
    return this.purchase?.id ?? '';
  }

  get paymentMethodOptions(): SearchableSelectOption[] {
    return this.paymentMethods.map(method => ({ value: method.value, label: method.label }));
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

  paymentMethodLabel(method: number): string {
    return PAYMENT_METHOD_LABELS[method] ?? 'Otro';
  }

  cancelPurchase(): void {
    if (!this.purchase || !confirm('¿Cancelar esta compra? Esta acción no se puede deshacer.')) return;
    this.cancelling = true;
    this.purchaseService.cancelPurchase(this.purchaseId).subscribe({
      next: () => {
        this.toast.success('Compra cancelada');
        this.router.navigate(['/purchases']);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al cancelar la compra');
        this.cancelling = false;
        this.cdr.markForCheck();
      }
    });
  }

  submitPayment(): void {
    if (this.newPaymentAmount <= 0) { this.toast.error('El monto debe ser mayor a 0'); return; }
    if (!this.newPaymentDate) { this.toast.error('Indicá la fecha del pago'); return; }

    this.addingPayment = true;
    const req: AddPurchasePaymentRequest = {
      method: this.newPaymentMethod,
      amount: this.newPaymentAmount,
      date: this.newPaymentDate,
      reference: this.newPaymentReference.trim() || null,
      notes: this.newPaymentNotes.trim() || null
    };

    this.purchaseService.addPayment(this.purchaseId, req).subscribe({
      next: () => {
        this.addingPayment = false;
        this.newPaymentAmount = 0;
        this.newPaymentReference = '';
        this.newPaymentNotes = '';
        this.newPaymentDate = this.todayIso();
        this.toast.success('Pago registrado');
        this.load(this.purchaseId);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al registrar el pago');
        this.addingPayment = false;
        this.cdr.markForCheck();
      }
    });
  }

  cancelPayment(payment: PurchasePayment): void {
    if (!confirm('¿Anular este pago? Esta acción no se puede deshacer.')) return;
    this.cancellingPaymentId = payment.id;
    this.purchaseService.cancelPayment(this.purchaseId, payment.id).subscribe({
      next: () => {
        this.toast.success('Pago anulado');
        this.cancellingPaymentId = null;
        this.load(this.purchaseId);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al anular el pago');
        this.cancellingPaymentId = null;
        this.cdr.markForCheck();
      }
    });
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
