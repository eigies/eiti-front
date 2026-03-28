import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { SaleService } from '../../../core/services/sale.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CustomerSearchItem } from '../../../core/models/customer.models';
import {
  CcSaleListItem,
  SaleByIdResponse,
  CcPaymentResponse
} from '../../../core/models/sale.models';
import { SALE_PAYMENT_METHODS, SalePaymentMethodOption } from '../../../core/models/sale-payment.models';

interface PaymentGroup {
  groupId: string | null;
  payments: CcPaymentResponse[];
  totalAmount: number;
  date: string;
  notes: string | null;
  status: number;
}

@Component({
  selector: 'app-clients-cc',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './clients-cc.component.html',
  styleUrls: ['./clients-cc.component.css']
})
export class ClientsCcComponent {
  readonly paymentMethods: SalePaymentMethodOption[] = SALE_PAYMENT_METHODS;

  // Customer search
  customerQuery = '';
  searchResults: CustomerSearchItem[] = [];
  selectedCustomer: CustomerSearchItem | null = null;
  ccSales: CcSaleListItem[] = [];
  loading = false;

  // Payments modal (read-only)
  modalOpen = false;
  modalSale: SaleByIdResponse | null = null;
  modalPayments: CcPaymentResponse[] = [];
  modalLoading = false;
  modalCancellingGroupId: string | null = null;
  modalCancellingPaymentId: string | null = null;

  // Detalle modal (read-only sale detail)
  detalleModalOpen = false;
  detalleModalSaleId: string | null = null;

  constructor(
    private readonly customerService: CustomerService,
    private readonly saleService: SaleService,
    private readonly toast: ToastService,
    private readonly router: Router
  ) {}

  // ── Customer search ──────────────────────────────────────

  searchCustomers(): void {
    const query = this.customerQuery.trim();
    if (!query) {
      this.toast.error('Ingresa un termino de busqueda');
      return;
    }
    this.customerService.searchCustomers(query).subscribe({
      next: results => {
        this.searchResults = results;
        if (results.length === 0) this.toast.error('No se encontraron clientes');
      },
      error: () => this.toast.error('No se pudo buscar clientes')
    });
  }

  selectCustomer(customer: CustomerSearchItem): void {
    this.selectedCustomer = customer;
    this.searchResults = [];
    this.customerQuery = '';
    this.loadCcSales();
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
    this.ccSales = [];
  }

  private loadCcSales(): void {
    if (!this.selectedCustomer) return;
    this.loading = true;
    this.saleService.listCcSales(this.selectedCustomer.id).subscribe({
      next: sales => {
        this.ccSales = sales;
        this.loading = false;
      },
      error: () => {
        this.toast.error('No se pudieron cargar las ventas CC');
        this.loading = false;
      }
    });
  }

  statusLabel(sale: CcSaleListItem): string {
    if (sale.idSaleStatus === 3) return 'Cancelada';
    if (sale.idSaleStatus === 2) return 'Pagada';
    if (sale.ccPaidTotal > 0 && sale.ccPaidTotal < sale.totalAmount) return 'Pago parcial';
    return 'En espera';
  }

  statusClass(sale: CcSaleListItem): string {
    if (sale.idSaleStatus === 3) return 'badge badge--cancelled';
    if (sale.idSaleStatus === 2) return 'badge badge--paid';
    if (sale.ccPaidTotal > 0 && sale.ccPaidTotal < sale.totalAmount) return 'badge badge--partial';
    return 'badge badge--pending';
  }

  // ── Payments modal ───────────────────────────────────────

  openModal(sale: CcSaleListItem): void {
    this.modalOpen = true;
    this.modalSale = null;
    this.modalPayments = [];
    this.modalLoading = true;

    this.saleService.getSaleById(sale.id).subscribe({
      next: saleDetail => {
        this.modalSale = saleDetail;
        this.modalLoading = false;
      },
      error: () => {
        this.toast.error('No se pudo cargar la venta');
        this.modalLoading = false;
      }
    });

    this.saleService.listCcPayments(sale.id).subscribe({
      next: payments => this.modalPayments = payments,
      error: () => this.toast.error('No se pudieron cargar los pagos')
    });
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalSale = null;
    this.modalPayments = [];
  }

  navigateToPayments(saleId: string): void {
    this.closeModal();
    this.router.navigate(['/sales-cc', saleId, 'payments']);
  }

  get modalRemaining(): number {
    return this.modalSale?.ccPendingAmount ?? 0;
  }

  get modalStatusLabel(): string {
    if (!this.modalSale) return '';
    if (this.modalSale.idSaleStatus === 3) return 'Cancelada';
    if (this.modalSale.idSaleStatus === 2) return 'Pagada';
    const paid = this.modalSale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < this.modalSale.totalAmount) return 'Pago parcial';
    return 'En espera';
  }

  get modalStatusClass(): string {
    if (!this.modalSale) return '';
    if (this.modalSale.idSaleStatus === 3) return 'badge--cancelled';
    if (this.modalSale.idSaleStatus === 2) return 'badge--paid';
    const paid = this.modalSale.ccPaidTotal ?? 0;
    if (paid > 0 && paid < this.modalSale.totalAmount) return 'badge--partial';
    return 'badge--pending';
  }

  get modalGroupedPayments(): PaymentGroup[] {
    const groups = new Map<string, CcPaymentResponse[]>();
    const ungrouped: CcPaymentResponse[] = [];

    for (const p of this.modalPayments) {
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
      result.push({ groupId: null, payments: [p], totalAmount: p.amount, date: p.date, notes: p.notes ?? null, status: p.status });
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  paymentMethodLabel(id: number): string {
    return this.paymentMethods.find(m => m.id === id)?.label ?? 'Otro';
  }

  isCancellingModalGroup(group: PaymentGroup): boolean {
    if (group.groupId) return this.modalCancellingGroupId === group.groupId;
    return this.modalCancellingPaymentId === group.payments[0]?.id;
  }

  // ── Detalle modal ─────────────────────────────────────────

  openDetalle(sale: CcSaleListItem): void {
    this.detalleModalSaleId = sale.id;
    this.detalleModalOpen = true;

    // Load sale detail if not already loaded (or if modalSale belongs to a different sale)
    if (!this.modalSale || this.modalSale.id !== sale.id) {
      this.modalLoading = true;
      this.saleService.getSaleById(sale.id).subscribe({
        next: saleDetail => {
          this.modalSale = saleDetail;
          this.modalLoading = false;
        },
        error: () => {
          this.toast.error('No se pudo cargar el detalle');
          this.modalLoading = false;
          this.detalleModalOpen = false;
        }
      });
    }
  }

  closeDetalle(): void {
    this.detalleModalOpen = false;
    this.detalleModalSaleId = null;
  }

  get detalleModalSale(): SaleByIdResponse | null {
    if (this.detalleModalSaleId && this.modalSale?.id === this.detalleModalSaleId) {
      return this.modalSale;
    }
    return null;
  }

  get detalleSubtotal(): number {
    if (!this.detalleModalSale?.details) return 0;
    return this.detalleModalSale.details.reduce((sum, d) => sum + d.totalAmount, 0);
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
}
