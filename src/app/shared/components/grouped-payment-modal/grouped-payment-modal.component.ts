import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { BankInstallmentPlanResponse, BankResponse } from '../../../core/models/bank.models';
import { CarteraChequeOption } from '../../../core/models/cheque.models';
import {
  GroupedPaymentLine,
  GroupedPaymentSubmit,
  PaymentMeansMethod,
  PendingDocument
} from '../../../core/models/account-ledger.models';
import { formatMoney } from '../../utils/money.util';
import { formatLedgerDate, formatShortDate } from '../../utils/ledger-format.util';
import { SearchableSelectComponent, SearchableSelectOption } from '../searchable-select/searchable-select.component';

export type GroupedPaymentMode = 'supplier' | 'customer';

interface MethodDef {
  value: number;
  code: PaymentMeansMethod;
  label: string;
  quickAdd: boolean;
}

// Códigos de medio de cada lado (PurchasePaymentMethod / SalePaymentMethod del backend).
const METHODS: Record<GroupedPaymentMode, MethodDef[]> = {
  supplier: [
    { value: 1, code: 'cash', label: 'Efectivo', quickAdd: true },
    { value: 2, code: 'transfer', label: 'Transferencia', quickAdd: true },
    { value: 3, code: 'check', label: 'Cheque de cartera', quickAdd: true },
    { value: 4, code: 'other', label: 'Otro', quickAdd: false }
  ],
  customer: [
    { value: 1, code: 'cash', label: 'Efectivo', quickAdd: true },
    { value: 2, code: 'transfer', label: 'Transferencia', quickAdd: true },
    { value: 3, code: 'card', label: 'Tarjeta', quickAdd: true },
    { value: 4, code: 'check', label: 'Cheque', quickAdd: true },
    { value: 5, code: 'other', label: 'Otro', quickAdd: false }
  ]
};

interface ChequeForm {
  bankId: FormControl<number | null>;
  numero: FormControl<string>;
  titular: FormControl<string>;
  cuitDni: FormControl<string>;
  fechaEmision: FormControl<string>;
  fechaVencimiento: FormControl<string>;
}

interface LineForm {
  method: FormControl<number>;
  amount: FormControl<number | null>;
  reference: FormControl<string>;
  chequeId: FormControl<string | null>;
  cardBankId: FormControl<number | null>;
  cardCuotas: FormControl<number | null>;
  transferBankId: FormControl<number | null>;
  cheque: FormGroup<ChequeForm>;
}

export interface FifoPreviewRow {
  code: string;
  date: string;
  amount: number;
  settles: boolean;
}

/**
 * Pago a un proveedor / cobro a un cliente con varios medios en un solo comprobante (OP / RC).
 * Cada línea es un medio; el total y a qué facturas se va a imputar (de la más vieja a la más nueva,
 * igual que el backend) se ven en vivo. No llama a la API: emite `submitted` y la página registra.
 * Confirmar queda bloqueado mientras cargan los cheques/bancos: un formulario de plata no se puede
 * mandar con datos que todavía no llegaron (lección del 08/08).
 */
@Component({
  selector: 'app-grouped-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './grouped-payment-modal.component.html',
  styleUrls: ['./grouped-payment-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupedPaymentModalComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) mode: GroupedPaymentMode = 'supplier';
  @Input() counterpartyName = '';
  /** Pendientes de la cuenta, de la más vieja a la más nueva. */
  @Input() pending: PendingDocument[] = [];
  /** Lo que se quiere cancelar (las seleccionadas en Pendientes); por defecto, todo lo pendiente. */
  @Input() targetAmount: number | null = null;
  @Input() banks: BankResponse[] = [];
  @Input() carteraCheques: CarteraChequeOption[] = [];
  @Input() optionsLoading = false;
  @Input() submitting = false;

  @Output() readonly submitted = new EventEmitter<GroupedPaymentSubmit>();
  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('firstAction') firstAction?: ElementRef<HTMLButtonElement>;

  readonly form = this.fb.group({
    date: this.fb.nonNullable.control(new Date().toLocaleDateString('en-CA'), Validators.required),
    notes: this.fb.nonNullable.control('', Validators.maxLength(500)),
    lines: this.fb.array<FormGroup<LineForm>>([])
  });

  constructor(
    private readonly fb: FormBuilder,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  ngAfterViewInit(): void {
    // La página de atrás no scrollea mientras el modal está abierto.
    this.document.body.classList.add('modal-open');
    this.firstAction?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('modal-open');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  // ── Medios ─────────────────────────────────────────────────

  get lines(): FormArray<FormGroup<LineForm>> {
    return this.form.controls.lines;
  }

  get methods(): MethodDef[] {
    return METHODS[this.mode];
  }

  get quickAddMethods(): MethodDef[] {
    return this.methods.filter(m => m.quickAdd);
  }

  get methodOptions(): SearchableSelectOption[] {
    return this.methods.map(m => ({ value: m.value, label: m.label }));
  }

  get groupLabel(): string {
    return this.mode === 'supplier' ? 'orden de pago' : 'recibo';
  }

  get verb(): string {
    return this.mode === 'supplier' ? 'pago' : 'cobro';
  }

  codeOf(line: FormGroup<LineForm>): PaymentMeansMethod {
    return this.methods.find(m => m.value === line.controls.method.value)?.code ?? 'other';
  }

  addLine(method: number): void {
    const line = this.fb.group<LineForm>({
      method: this.fb.nonNullable.control(method),
      amount: this.fb.control<number | null>(null),
      reference: this.fb.nonNullable.control('', Validators.maxLength(120)),
      chequeId: this.fb.control<string | null>(null),
      cardBankId: this.fb.control<number | null>(null),
      cardCuotas: this.fb.control<number | null>(null),
      transferBankId: this.fb.control<number | null>(null),
      cheque: this.fb.group<ChequeForm>({
        bankId: this.fb.control<number | null>(null),
        numero: this.fb.nonNullable.control(''),
        titular: this.fb.nonNullable.control(''),
        cuitDni: this.fb.nonNullable.control(''),
        fechaEmision: this.fb.nonNullable.control(new Date().toLocaleDateString('en-CA')),
        fechaVencimiento: this.fb.nonNullable.control('')
      })
    }, { validators: control => this.validateLine(control) });

    this.lines.push(line);
    this.applyMethodDefaults(line);
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  onMethodChange(line: FormGroup<LineForm>, value: string | number | null): void {
    line.controls.method.setValue(Number(value));
    line.patchValue({ chequeId: null, cardBankId: null, cardCuotas: null, transferBankId: null });
    this.applyMethodDefaults(line);
  }

  // Un medio nuevo arranca con lo que falta para llegar al objetivo; un cheque de cartera, con su monto.
  private applyMethodDefaults(line: FormGroup<LineForm>): void {
    const amount = line.controls.amount;
    if (this.isCarteraCheque(line)) {
      amount.disable({ emitEvent: false });
      amount.setValue(null);
      return;
    }
    amount.enable({ emitEvent: false });
    if (!amount.value) {
      const remaining = this.round(this.target - this.total);
      amount.setValue(remaining > 0 ? remaining : null);
    }
    if (this.codeOf(line) === 'card') this.preselectSingleCardBank(line);
  }

  isCarteraCheque(line: FormGroup<LineForm>): boolean {
    return this.mode === 'supplier' && this.codeOf(line) === 'check';
  }

  isReceivedCheque(line: FormGroup<LineForm>): boolean {
    return this.mode === 'customer' && this.codeOf(line) === 'check';
  }

  // ── Cheques de cartera (proveedor) ─────────────────────────

  chequeOptionsFor(line: FormGroup<LineForm>): SearchableSelectOption[] {
    const usedElsewhere = new Set(
      this.lines.controls.filter(l => l !== line).map(l => l.controls.chequeId.value).filter((id): id is string => !!id));
    return this.carteraCheques
      .filter(c => !usedElsewhere.has(c.id))
      .map(c => ({
        value: c.id,
        label: `Nº ${c.numero} · ${c.bankName} · vto ${formatShortDate(c.fechaVencimiento)} · $${formatMoney(c.monto)}`,
        searchText: `${c.titular} ${c.cuitDni}`,
        meta: `Recibido de ${c.titular}`
      }));
  }

  selectedCheque(line: FormGroup<LineForm>): CarteraChequeOption | null {
    const id = line.controls.chequeId.value;
    return id ? this.carteraCheques.find(c => c.id === id) ?? null : null;
  }

  onChequeChange(line: FormGroup<LineForm>, value: string | number | null): void {
    const cheque = this.carteraCheques.find(c => c.id === value) ?? null;
    line.controls.chequeId.setValue(cheque?.id ?? null);
    line.controls.amount.setValue(cheque?.monto ?? null);
  }

  // ── Bancos (cliente: tarjeta, transferencia, cheque recibido) ──

  get cardBankOptions(): SearchableSelectOption[] {
    return this.banks
      .filter(b => b.active && b.useForCard && b.plans.some(p => p.active))
      .map(b => ({ value: b.id, label: b.name }));
  }

  get transferBankOptions(): SearchableSelectOption[] {
    return this.banks.filter(b => b.active && b.useForTransfer).map(b => ({ value: b.id, label: b.name }));
  }

  get chequeBankOptions(): SearchableSelectOption[] {
    return this.banks.filter(b => b.active && b.useForCheque).map(b => ({ value: b.id, label: b.name }));
  }

  private plansFor(bankId: number | null): BankInstallmentPlanResponse[] {
    if (!bankId) return [];
    return (this.banks.find(b => b.id === bankId)?.plans ?? []).filter(p => p.active);
  }

  cuotasOptionsFor(line: FormGroup<LineForm>): SearchableSelectOption[] {
    return this.plansFor(line.controls.cardBankId.value).map(plan => ({
      value: plan.cuotas,
      label: `${plan.cuotas} cuota${plan.cuotas > 1 ? 's' : ''}`,
      meta: plan.surchargePct > 0 ? `Recargo ${plan.surchargePct}%` : 'Sin recargo'
    }));
  }

  onCardBankChange(line: FormGroup<LineForm>, value: string | number | null): void {
    const bankId = value === null ? null : Number(value);
    line.controls.cardBankId.setValue(bankId);
    const plans = this.plansFor(bankId);
    line.controls.cardCuotas.setValue(plans.length === 1 ? plans[0].cuotas : null);
  }

  private preselectSingleCardBank(line: FormGroup<LineForm>): void {
    const options = this.cardBankOptions;
    if (options.length === 1 && !line.controls.cardBankId.value) this.onCardBankChange(line, options[0].value);
  }

  /** Recargo de tarjeta: informativo, lo imputado a la cuenta es el importe sin recargo. */
  cardSurcharge(line: FormGroup<LineForm>): number {
    const plan = this.plansFor(line.controls.cardBankId.value).find(p => p.cuotas === line.controls.cardCuotas.value);
    const amount = line.controls.amount.value ?? 0;
    return plan && plan.surchargePct > 0 ? this.round(amount * plan.surchargePct / 100) : 0;
  }

  // ── Validación ─────────────────────────────────────────────

  private validateLine(control: AbstractControl): ValidationErrors | null {
    const line = control as FormGroup<LineForm>;
    const v = line.getRawValue();
    const errors: ValidationErrors = {};
    const code = this.codeOf(line);

    if (this.isCarteraCheque(line)) {
      if (!v.chequeId) errors['cheque'] = 'Elegí el cheque de cartera.';
    } else if (!v.amount || v.amount <= 0) {
      errors['amount'] = 'El importe tiene que ser mayor a cero.';
    }

    if (this.mode === 'customer') {
      if (code === 'card' && this.cardBankOptions.length > 0 && (!v.cardBankId || !v.cardCuotas)) {
        errors['card'] = 'Elegí banco y cuotas.';
      }
      // Obligatorio solo si la empresa tiene bancos de transferencia: si no, no se puede elegir.
      if (code === 'transfer' && this.transferBankOptions.length > 0 && !v.transferBankId) {
        errors['transfer'] = 'Elegí el banco que recibió la transferencia.';
      }
      if (code === 'check') {
        const c = v.cheque;
        if (!c.bankId || !c.numero.trim() || !c.titular.trim() || !c.cuitDni.trim() || !c.fechaEmision || !c.fechaVencimiento) {
          errors['chequeData'] = 'Completá los datos del cheque.';
        }
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  lineError(line: FormGroup<LineForm>): string | null {
    const errors = line.errors;
    if (!errors || !(line.dirty || line.touched)) return null;
    return (Object.values(errors)[0] as string) ?? null;
  }

  // ── Resumen ────────────────────────────────────────────────

  private lineAmount(line: FormGroup<LineForm>): number {
    return line.getRawValue().amount ?? 0;
  }

  get total(): number {
    return this.round(this.lines.controls.reduce((sum, line) => sum + this.lineAmount(line), 0));
  }

  get pendingTotal(): number {
    return this.round(this.pending.reduce((sum, p) => sum + p.pending, 0));
  }

  /** Objetivo del pago: lo seleccionado en Pendientes o, si no, todo lo pendiente. */
  get target(): number {
    return this.targetAmount && this.targetAmount > 0 ? this.targetAmount : this.pendingTotal;
  }

  get difference(): number {
    return this.round(this.total - this.target);
  }

  get creditLeft(): number {
    return Math.max(0, this.round(this.total - this.pendingTotal));
  }

  get subtotals(): { label: string; count: number; amount: number }[] {
    const groups = new Map<string, { label: string; count: number; amount: number }>();
    for (const line of this.lines.controls) {
      const def = this.methods.find(m => m.value === line.controls.method.value);
      const label = def?.code === 'check' ? 'Cheques' : def?.label ?? 'Otro';
      const group = groups.get(label) ?? { label, count: 0, amount: 0 };
      group.count += 1;
      group.amount = this.round(group.amount + this.lineAmount(line));
      groups.set(label, group);
    }
    return [...groups.values()];
  }

  /** A qué se va a imputar: de la más vieja a la más nueva, como lo hace el backend. */
  get fifoPreview(): FifoPreviewRow[] {
    let remaining = this.total;
    const rows: FifoPreviewRow[] = [];
    for (const doc of this.pending) {
      if (remaining <= 0) break;
      const amount = this.round(Math.min(remaining, doc.pending));
      rows.push({ code: doc.code, date: doc.date, amount, settles: amount >= doc.pending });
      remaining = this.round(remaining - amount);
    }
    return rows;
  }

  get canSubmit(): boolean {
    return !this.submitting && !this.optionsLoading && this.lines.length > 0 && this.form.valid && this.total > 0;
  }

  /** Por qué Confirmar está deshabilitado, para no dejar al usuario adivinando. */
  get blockedReason(): string | null {
    if (this.optionsLoading) return this.mode === 'supplier' ? 'Cargando cheques de cartera…' : 'Cargando bancos…';
    if (this.lines.length === 0) return 'Agregá al menos un medio.';
    if (this.form.controls.date.invalid) return 'Elegí la fecha del pago.';
    const invalid = this.lines.controls.findIndex(line => line.invalid);
    if (invalid >= 0) {
      const errors = this.lines.at(invalid).errors ?? {};
      return `Medio ${invalid + 1}: ${(Object.values(errors)[0] as string) ?? 'revisá los datos.'}`;
    }
    return null;
  }

  // ── Confirmar / cerrar ─────────────────────────────────────

  submit(): void {
    this.lines.controls.forEach(line => line.markAllAsTouched());
    if (!this.canSubmit) return;

    const raw = this.form.getRawValue();
    this.submitted.emit({
      date: raw.date,
      notes: raw.notes.trim() || null,
      lines: this.lines.controls.map(line => this.toLine(line))
    });
  }

  private toLine(line: FormGroup<LineForm>): GroupedPaymentLine {
    const v = line.getRawValue();
    const code = this.codeOf(line);
    const amount = v.amount ?? 0;
    return {
      method: v.method,
      amount,
      reference: v.reference.trim() || null,
      chequeId: this.isCarteraCheque(line) ? v.chequeId : null,
      cardBankId: code === 'card' ? v.cardBankId : null,
      cardCuotas: code === 'card' ? v.cardCuotas : null,
      transferBankId: this.mode === 'customer' && code === 'transfer' ? v.transferBankId : null,
      cheque: this.isReceivedCheque(line) && v.cheque.bankId
        ? {
            bankId: v.cheque.bankId,
            numero: v.cheque.numero.trim(),
            titular: v.cheque.titular.trim(),
            cuitDni: v.cheque.cuitDni.trim(),
            monto: amount,
            fechaEmision: v.cheque.fechaEmision,
            fechaVencimiento: v.cheque.fechaVencimiento,
            notas: null
          }
        : null
    };
  }

  close(): void {
    if (!this.submitting) this.closed.emit();
  }

  // ── Formato ────────────────────────────────────────────────

  money(value: number): string {
    return formatMoney(value);
  }

  date(value: string): string {
    return formatLedgerDate(value);
  }

  trackLine(index: number): number {
    return index;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
