import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PurchaseService } from '../../core/services/purchase.service';
import { PurchaseDetailResponse, PurchaseStatus } from '../../core/models/purchase.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';

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
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
