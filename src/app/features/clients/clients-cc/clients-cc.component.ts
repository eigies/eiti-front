import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { jsPDF } from 'jspdf';
import { CustomerService } from '../../../core/services/customer.service';
import { SaleService } from '../../../core/services/sale.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PermissionCodes } from '../../../core/models/permission.models';
import { CustomerSearchItem } from '../../../core/models/customer.models';
import {
  CcSaleListItem,
  SaleByIdResponse,
  CcPaymentResponse
} from '../../../core/models/sale.models';
import { SALE_PAYMENT_METHODS, SalePaymentMethodOption } from '../../../core/models/sale-payment.models';
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
  selector: 'app-clients-cc',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './clients-cc.component.html',
  styleUrls: ['./clients-cc.component.css']
})
export class ClientsCcComponent {
  readonly paymentMethods: SalePaymentMethodOption[] = SALE_PAYMENT_METHODS;
  readonly permissionCodes = PermissionCodes;
  cancellingSaleId: string | null = null;

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
    readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly router: Router,
    private readonly confirmation: ConfirmationService
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
    if (id === 6) return 'Saldo a favor';
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

  exportModalPdf(): void {
    const sale = this.modalSale;
    if (!sale) return;

    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;
    const colWidths = [12, 84, 18, 34, 34];
    const colX = [
      margin,
      margin + colWidths[0],
      margin + colWidths[0] + colWidths[1],
      margin + colWidths[0] + colWidths[1] + colWidths[2],
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
    ];
    const fmt = (v: number) => `$${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (v: string) => new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const fmtDateShort = (v: string) => new Date(v).toLocaleDateString('es-AR');

    let y = margin;

    // Header
    doc.setDrawColor(35, 35, 35);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 20, 20);
    doc.text('Comprobante de venta', margin + 4, y + 8);
    doc.setFontSize(10);
    doc.text(sale.code ? `Nro. ${sale.code}` : `ID: ${sale.id}`, margin + 4, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Emitido: ${fmtDate(new Date().toISOString())}`, pageWidth - margin - 4, y + 8, { align: 'right' });
    doc.text(`Fecha venta: ${fmtDate(sale.createdAt)}`, pageWidth - margin - 4, y + 14, { align: 'right' });
    y += 25;

    // Meta block
    const metaTop = y;
    const metaHeight = 38;
    const halfWidth = contentWidth / 2;
    const rowH = 6.5;
    const lx = margin + 3;
    const rx = margin + halfWidth + 3;
    const vo = 22;
    const statusLabel = sale.idSaleStatus === 3 ? 'Cancelada' : sale.idSaleStatus === 2 ? 'Pagada' :
      (sale.ccPaidTotal > 0 && sale.ccPaidTotal < sale.totalAmount) ? 'Pago parcial' : 'En espera';
    const rowsL = [
      ['Cliente', sale.customerFullName || '-'],
      ['Documento', sale.customerDocument || sale.customerTaxId || '-'],
      ['Items', `${sale.details.length}`],
      ['Tipo', 'Cuenta Corriente']
    ];
    const rowsR = [
      ['Total', fmt(sale.totalAmount)],
      ['Cobrado', fmt(sale.ccPaidTotal ?? 0)],
      ['Pendiente', fmt(sale.ccPendingAmount ?? 0)],
      ['Estado', statusLabel]
    ];
    doc.setDrawColor(185, 185, 185);
    doc.rect(margin, metaTop, contentWidth, metaHeight);
    doc.line(margin + halfWidth, metaTop, margin + halfWidth, metaTop + metaHeight);
    doc.setFontSize(9);
    for (let i = 0; i < 4; i++) {
      const ry = metaTop + 6 + i * rowH;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(70, 70, 70);
      doc.text(`${rowsL[i][0]}:`, lx, ry);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 25, 25);
      doc.text(rowsL[i][1], lx + vo, ry, { maxWidth: halfWidth - vo - 6 });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(70, 70, 70);
      doc.text(`${rowsR[i][0]}:`, rx, ry);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 25, 25);
      doc.text(rowsR[i][1], rx + vo, ry, { maxWidth: halfWidth - vo - 6 });
    }
    y = metaTop + metaHeight + 6;

    // Products table
    const drawItemsHeader = (cont: boolean) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(25, 25, 25);
      doc.text(cont ? 'Detalle de productos (continuacion)' : 'Detalle de productos', margin, y);
      y += 5;
      doc.setFillColor(232, 232, 232); doc.setDrawColor(170, 170, 170);
      doc.rect(margin, y, contentWidth, 8, 'FD');
      doc.setFontSize(8.6);
      doc.text('#', colX[0] + 2, y + 5.3);
      doc.text('Producto', colX[1] + 2, y + 5.3);
      doc.text('Cant.', colX[2] + colWidths[2] - 2, y + 5.3, { align: 'right' });
      doc.text('Unitario', colX[3] + colWidths[3] - 2, y + 5.3, { align: 'right' });
      doc.text('Subtotal', colX[4] + colWidths[4] - 2, y + 5.3, { align: 'right' });
      y += 8;
    };

    drawItemsHeader(false);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(25, 25, 25);

    for (let i = 0; i < sale.details.length; i++) {
      const detail = sale.details[i];
      const text = `${detail.productBrand} / ${detail.productName}`;
      const wrapped = doc.splitTextToSize(text, colWidths[1] - 4) as string[];
      const rh = Math.max(8, wrapped.length * 3.8 + 2.5);
      if (y + rh > printableBottom) { doc.addPage(); y = margin; drawItemsHeader(true); }
      doc.setDrawColor(205, 205, 205);
      doc.rect(colX[0], y, colWidths[0], rh);
      doc.rect(colX[1], y, colWidths[1], rh);
      doc.rect(colX[2], y, colWidths[2], rh);
      doc.rect(colX[3], y, colWidths[3], rh);
      doc.rect(colX[4], y, colWidths[4], rh);
      doc.text(`${i + 1}`, colX[0] + 2, y + rh / 2 + 1.2);
      doc.text(wrapped, colX[1] + 2, y + 4.6);
      doc.text(`${detail.quantity}`, colX[2] + colWidths[2] - 2, y + rh / 2 + 1.2, { align: 'right' });
      doc.text(fmt(detail.unitPrice), colX[3] + colWidths[3] - 2, y + rh / 2 + 1.2, { align: 'right' });
      doc.text(fmt(detail.totalAmount), colX[4] + colWidths[4] - 2, y + rh / 2 + 1.2, { align: 'right' });
      y += rh;
    }

    // Total summary row
    if (y + 24 > printableBottom) { doc.addPage(); y = margin; }
    const sw = 72;
    const sx = pageWidth - margin - sw;
    doc.setFillColor(246, 246, 246); doc.setDrawColor(150, 150, 150);
    doc.roundedRect(sx, y + 5, sw, 16, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 45, 45); doc.setFontSize(9.5);
    doc.text('TOTAL VENTA', sx + 3, y + 11);
    doc.setFontSize(12.5);
    doc.text(fmt(sale.totalAmount), sx + sw - 3, y + 17, { align: 'right' });
    y += 26;

    // Payment history
    const groups = this.modalGroupedPayments;
    if (groups.length > 0) {
      if (y + 16 > printableBottom) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(25, 25, 25);
      doc.text('Historial de pagos CC', margin, y);
      y += 5;

      const phColW = [38, 60, 38, 22];
      const phColX = [margin, margin + phColW[0], margin + phColW[0] + phColW[1], margin + phColW[0] + phColW[1] + phColW[2]];
      doc.setFillColor(232, 232, 232); doc.setDrawColor(170, 170, 170);
      doc.rect(margin, y, contentWidth, 7, 'FD');
      doc.setFontSize(8.4); doc.setTextColor(40, 40, 40);
      doc.text('Fecha', phColX[0] + 2, y + 4.8);
      doc.text('Metodo', phColX[1] + 2, y + 4.8);
      doc.text('Monto', phColX[2] + phColW[2] - 2, y + 4.8, { align: 'right' });
      doc.text('Estado', phColX[3] + 2, y + 4.8);
      y += 7;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3);
      for (const group of groups) {
        const methodNames = group.payments.map(p => this.paymentMethodLabel(p.idPaymentMethod)).join(' + ');
        const rh = 7;
        if (y + rh > printableBottom) { doc.addPage(); y = margin; }
        doc.setDrawColor(210, 210, 210);
        doc.rect(phColX[0], y, phColW[0], rh);
        doc.rect(phColX[1], y, phColW[1], rh);
        doc.rect(phColX[2], y, phColW[2], rh);
        doc.rect(phColX[3], y, phColW[3], rh);
        doc.setTextColor(group.status === 2 ? 150 : 25, group.status === 2 ? 150 : 25, group.status === 2 ? 150 : 25);
        doc.text(fmtDateShort(group.date), phColX[0] + 2, y + 4.6);
        doc.text(methodNames, phColX[1] + 2, y + 4.6, { maxWidth: phColW[1] - 4 });
        doc.text(fmt(group.totalAmount), phColX[2] + phColW[2] - 2, y + 4.6, { align: 'right' });
        doc.text(group.status === 1 ? 'Activo' : 'Anulado', phColX[3] + 2, y + 4.6);
        y += rh;
      }
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(205, 205, 205);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text('Documento para control interno de venta', margin, pageHeight - 8);
      doc.text(`Pagina ${p} de ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(`venta-cc-${sale.code ?? sale.createdAt.slice(0, 10)}.pdf`);
  }

  async cancelSale(sale: CcSaleListItem, event: Event): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Cuenta corriente',
      title: 'Anular venta',
      message: `Vas a anular la venta ${sale.code || 'seleccionada'}.`,
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Anular venta',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.cancellingSaleId = sale.id;
    this.saleService.cancelSale(sale.id).subscribe({
      next: () => {
        this.cancellingSaleId = null;
        this.toast.success('Venta anulada');
        this.ccSales = this.ccSales.map(s =>
          s.id === sale.id ? { ...s, idSaleStatus: 3 } : s
        );
      },
      error: (err) => {
        this.cancellingSaleId = null;
        this.toast.error(err?.error?.detail || 'No se pudo anular la venta');
      }
    });
  }
}
