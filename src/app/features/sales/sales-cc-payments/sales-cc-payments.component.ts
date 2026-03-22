import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SaleByIdResponse, CcPaymentResponse } from '../../../core/models/sale.models';
import { SALE_PAYMENT_METHODS } from '../../../core/models/sale-payment.models';

@Component({
  selector: 'app-sales-cc-payments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './sales-cc-payments.component.html',
  styleUrls: ['./sales-cc-payments.component.css']
})
export class SalesCcPaymentsComponent implements OnInit {
  readonly paymentMethods = SALE_PAYMENT_METHODS;
  saleId = '';
  sale: SaleByIdResponse | null = null;
  payments: CcPaymentResponse[] = [];
  loading = true;
  addingPayment = false;
  cancellingPaymentId: string | null = null;
  paymentForm!: FormGroup;

  constructor(
    private readonly saleService: SaleService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.saleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.paymentForm = this.fb.group({
      idPaymentMethod: [1, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [this.todayIso(), [Validators.required]],
      notes: ['']
    });
    this.reload();
  }

  get remaining(): number {
    return this.sale?.ccPendingAmount ?? 0;
  }

  get activePayments(): CcPaymentResponse[] {
    return this.payments.filter(p => p.status === 1);
  }

  get cancelledPayments(): CcPaymentResponse[] {
    return this.payments.filter(p => p.status === 2);
  }

  get statusLabel(): string {
    if (!this.sale) return '';
    return this.sale.idSaleStatus === 2 ? 'Pagada' : 'En espera';
  }

  get statusClass(): string {
    if (!this.sale) return '';
    return this.sale.idSaleStatus === 2 ? 'badge--paid' : 'badge--pending';
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

  submitPayment(): void {
    if (this.paymentForm.invalid || this.addingPayment) return;
    this.addingPayment = true;
    const val = this.paymentForm.value;
    this.saleService.addCcPayment(this.saleId, {
      idPaymentMethod: Number(val.idPaymentMethod),
      amount: Number(val.amount),
      date: val.date,
      notes: val.notes || null
    }).subscribe({
      next: () => {
        this.addingPayment = false;
        this.toast.success('Pago registrado');
        this.paymentForm.patchValue({ amount: null, notes: '' });
        this.reload();
      },
      error: (err: any) => {
        this.addingPayment = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'Error al registrar el pago');
      }
    });
  }

  requestCancel(paymentId: string): void {
    if (!confirm('¿Anular este pago? Esta accion no se puede deshacer.')) return;
    this.cancellingPaymentId = paymentId;
    this.saleService.cancelCcPayment(this.saleId, paymentId).subscribe({
      next: () => {
        this.cancellingPaymentId = null;
        this.toast.success('Pago anulado');
        this.reload();
      },
      error: () => {
        this.cancellingPaymentId = null;
        this.toast.error('Error al anular el pago');
      }
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
