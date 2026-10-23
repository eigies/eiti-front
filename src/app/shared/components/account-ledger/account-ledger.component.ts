import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AccountLedger,
  AccountLedgerLabels,
  LedgerMeans,
  LedgerQuery,
  LedgerRow,
  PendingDocument,
  SUPPLIER_LEDGER_LABELS
} from '../../../core/models/account-ledger.models';
import { formatMoney } from '../../utils/money.util';
import { formatLedgerDate, meansDetail, rowDetail, rowSubtitle, rowTitle } from '../../utils/ledger-format.util';
import { AccountLedgerExportService } from '../../services/account-ledger-export.service';
import { ToastService } from '../../services/toast.service';

type LedgerTab = 'ledger' | 'pending';

// Pagos que se pueden anular desde el extracto: los grupos (OP/RC) enteros, los pagos sin grupo y las NC.
// Lo cargado en la compra/venta antes de la cuenta corriente se anula desde la compra/venta.
const CANCELLABLE_SOURCES = new Set(['payment_order', 'receipt', 'payment', 'credit_note']);

/**
 * Cuenta corriente como extracto: pestaña "Extracto" (renglones en orden cronológico con Debe / Haber /
 * Saldo acumulado, saldo anterior al rango y totales) y pestaña "Pendientes" (facturas/ventas con saldo).
 * Lo usan la cuenta del proveedor y la del cliente: solo cambian los textos (`labels`). No llama a la API:
 * avisa por outputs y la página decide.
 */
@Component({
  selector: 'app-account-ledger',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-ledger.component.html',
  styleUrls: ['./account-ledger.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountLedgerComponent implements OnChanges {
  @Input() ledger: AccountLedger | null = null;
  @Input() loading = false;
  @Input() labels: AccountLedgerLabels = SUPPLIER_LEDGER_LABELS;
  @Input() query: LedgerQuery = { dateFrom: null, dateTo: null, includeCancelled: false };
  /** Renglón con una acción en curso (anulación): deshabilita sus botones. */
  @Input() busyRowId: string | null = null;
  /** Permisos: anular pagos/cobros y anular notas de crédito son permisos distintos. */
  @Input() canCancelPayments = true;
  @Input() canCancelCreditNotes = true;
  @Input() canPay = true;

  @Output() readonly queryChange = new EventEmitter<LedgerQuery>();
  @Output() readonly paySelected = new EventEmitter<PendingDocument[]>();
  @Output() readonly cancelRow = new EventEmitter<LedgerRow>();
  @Output() readonly printRow = new EventEmitter<LedgerRow>();
  @Output() readonly openDocument = new EventEmitter<LedgerRow>();

  tab: LedgerTab = 'ledger';
  exporting = false;

  private readonly expanded = new Set<string>();
  private readonly selected = new Set<string>();
  private pendingIds = new Set<string>();

  constructor(
    private readonly exportService: AccountLedgerExportService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ledger']) {
      this.pendingIds = new Set((this.ledger?.pending ?? []).map(p => p.id));
      // Una selección que ya no está pendiente (se pagó) no puede seguir tildada.
      for (const id of [...this.selected]) {
        if (!this.pendingIds.has(id)) this.selected.delete(id);
      }
    }
  }

  // ── Pestañas y filtro ──────────────────────────────────────

  setTab(tab: LedgerTab): void {
    this.tab = tab;
  }

  onDateChange(field: 'dateFrom' | 'dateTo', event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.queryChange.emit({ ...this.query, [field]: value });
  }

  onIncludeCancelledChange(event: Event): void {
    this.queryChange.emit({ ...this.query, includeCancelled: (event.target as HTMLInputElement).checked });
  }

  get hasOpening(): boolean {
    return !!this.ledger?.dateFrom;
  }

  // ── Renglones ──────────────────────────────────────────────

  trackRow(_: number, row: LedgerRow): string {
    return `${row.source}:${row.id}`;
  }

  trackPending(_: number, doc: PendingDocument): string {
    return doc.id;
  }

  isExpandable(row: LedgerRow): boolean {
    return row.kind !== 'invoice';
  }

  isExpanded(row: LedgerRow): boolean {
    return this.expanded.has(this.trackRow(0, row));
  }

  toggle(row: LedgerRow): void {
    const key = this.trackRow(0, row);
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
  }

  canCancelRow(row: LedgerRow): boolean {
    const allowed = row.kind === 'credit_note' ? this.canCancelCreditNotes : this.canCancelPayments;
    return allowed && !row.isCancelled && CANCELLABLE_SOURCES.has(row.source);
  }

  canPrintRow(row: LedgerRow): boolean {
    return row.kind === 'payment' && !row.isCancelled && row.means.length > 0;
  }

  cancelLabel(row: LedgerRow): string {
    return row.kind === 'credit_note' ? 'Anular nota' : this.labels.cancelGroup;
  }

  tagLabel(row: LedgerRow): string {
    if (row.kind === 'invoice') return this.labels.invoice;
    if (row.kind === 'payment') return this.labels.payment;
    return 'N. crédito';
  }

  /** Si la factura a la que fue la imputación ya no tiene saldo. */
  isSettled(documentId: string): boolean {
    return !this.pendingIds.has(documentId);
  }

  title(row: LedgerRow): string {
    return rowTitle(row, this.labels);
  }

  subtitle(row: LedgerRow): string {
    return rowSubtitle(row, this.labels);
  }

  detail(row: LedgerRow): string {
    return rowDetail(row);
  }

  meansDetail(means: LedgerMeans): string {
    return meansDetail(means);
  }

  /** Importe con signo para la vista en tarjetas: + suma deuda, − la baja. */
  signedAmount(row: LedgerRow): string {
    return row.debit > 0 ? `+ ${this.money(row.debit)}` : `− ${this.money(row.credit)}`;
  }

  meansTotal(row: LedgerRow): number {
    return row.means.reduce((sum, m) => sum + m.amount, 0);
  }

  // ── Pendientes ─────────────────────────────────────────────

  isSelected(doc: PendingDocument): boolean {
    return this.selected.has(doc.id);
  }

  toggleSelected(doc: PendingDocument): void {
    if (this.selected.has(doc.id)) this.selected.delete(doc.id);
    else this.selected.add(doc.id);
  }

  get allSelected(): boolean {
    const pending = this.ledger?.pending ?? [];
    return pending.length > 0 && pending.every(p => this.selected.has(p.id));
  }

  toggleAll(): void {
    const pending = this.ledger?.pending ?? [];
    if (this.allSelected) this.selected.clear();
    else pending.forEach(p => this.selected.add(p.id));
  }

  get selectedDocs(): PendingDocument[] {
    return (this.ledger?.pending ?? []).filter(p => this.selected.has(p.id));
  }

  get selectedTotal(): number {
    return this.selectedDocs.reduce((sum, p) => sum + p.pending, 0);
  }

  get pendingTotals(): { total: number; imputed: number; pending: number } {
    return (this.ledger?.pending ?? []).reduce(
      (acc, p) => ({ total: acc.total + p.total, imputed: acc.imputed + p.imputed, pending: acc.pending + p.pending }),
      { total: 0, imputed: 0, pending: 0 });
  }

  paySelectedDocs(): void {
    if (this.selectedDocs.length > 0) this.paySelected.emit(this.selectedDocs);
  }

  // ── Exportar ───────────────────────────────────────────────

  exportExcel(): void {
    if (!this.ledger) return;
    try {
      this.exportService.exportExcel(this.ledger, this.labels);
    } catch {
      this.toast.error('No se pudo exportar el extracto a Excel');
    }
  }

  exportPdf(): void {
    if (!this.ledger || this.exporting) return;
    this.exporting = true;
    this.exportService.exportPdf(this.ledger, this.labels)
      .catch(() => this.toast.error('No se pudo exportar el extracto a PDF'))
      .finally(() => { this.exporting = false; this.cdr.markForCheck(); });
  }

  // ── Formato ────────────────────────────────────────────────

  money(value: number): string {
    return formatMoney(value);
  }

  date(value: string | null): string {
    return formatLedgerDate(value);
  }

  shortDate(value: string | null): string {
    return formatLedgerDate(value).slice(0, 5);
  }
}
