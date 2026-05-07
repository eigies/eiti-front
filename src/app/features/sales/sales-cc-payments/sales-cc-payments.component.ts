import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { jsPDF } from 'jspdf';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { CashService } from '../../../core/services/cash.service';
import { BankService } from '../../../core/services/bank.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SaleByIdResponse, CcPaymentResponse, AddCcPaymentGroupRequest } from '../../../core/models/sale.models';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SalePaymentInlineComponent],
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

  cashDrawers: CashDrawerResponse[] = [];
  selectedCashDrawerId = '';
  banks: BankResponse[] = [];

  paymentState: SalePaymentDraftState = createEmptySalePaymentDraftState();
  paymentForm!: FormGroup;

  constructor(
    private readonly saleService: SaleService,
    private readonly cashService: CashService,
    private readonly bankService: BankService,
    private readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder
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
      next: () => {
        this.addingPayment = false;
        this.toast.success('Pago registrado');
        this.paymentState = createEmptySalePaymentDraftState();
        this.paymentForm.patchValue({ notes: '' });
        this.reload();
      },
      error: (err: unknown) => {
        this.addingPayment = false;
        const e = err as { error?: { detail?: string; message?: string } };
        this.toast.error(e?.error?.detail || e?.error?.message || 'Error al registrar el pago');
      }
    });
  }

  requestCancel(group: PaymentGroup): void {
    if (!confirm('Anular este pago? Esta accion no se puede deshacer.')) return;

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

  exportPdf(): void {
    const sale = this.sale;
    if (!sale || sale.details.length === 0) {
      this.toast.error('La venta no tiene items para exportar.');
      return;
    }

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

    // Items header
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

    // Summary
    if (y + 24 > printableBottom) { doc.addPage(); y = margin; }
    const sw = 72;
    const sx = pageWidth - margin - sw;
    doc.setFillColor(246, 246, 246); doc.setDrawColor(150, 150, 150);
    doc.roundedRect(sx, y + 5, sw, 16, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 45, 45); doc.setFontSize(9.5);
    doc.text('TOTAL VENTA', sx + 3, y + 11);
    doc.setFontSize(12.5);
    doc.text(fmt(sale.totalAmount), sx + sw - 3, y + 17, { align: 'right' });

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

    doc.save(`venta-${sale.createdAt.slice(0, 10)}.pdf`);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
