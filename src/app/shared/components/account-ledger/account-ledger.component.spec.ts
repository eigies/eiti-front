import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { AccountLedger, LedgerQuery, LedgerRow, PendingDocument } from '../../../core/models/account-ledger.models';
import { AccountLedgerExportService } from '../../services/account-ledger-export.service';
import { ToastService } from '../../services/toast.service';
import { AccountLedgerComponent } from './account-ledger.component';

const doc = (id: string, amount: number): PendingDocument => ({
  id, date: '2026-10-01T00:00:00', code: id.toUpperCase(), document: null, total: amount, imputed: 0, pending: amount, ageDays: 3
});

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    kind: 'payment', source: 'payment_order', id: 'op-1', date: '2026-10-02T00:00:00', code: 'OP-0004',
    document: null, description: 'Orden de pago', debit: 0, credit: 100, balance: 0, isCancelled: false,
    means: [], imputations: [], ...partial
  };
}

function setup(pending: PendingDocument[] = [doc('c1', 325000), doc('c2', 980000)]) {
  const exportService = jasmine.createSpyObj<AccountLedgerExportService>('AccountLedgerExportService', ['exportExcel', 'exportPdf']);
  const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
  const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
  const component = new AccountLedgerComponent(exportService, toast, cdr);
  const ledger: AccountLedger = {
    accountId: 'sup-1', accountName: 'Distribuidora Norte', dateFrom: null, dateTo: null,
    openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, rows: [], pending
  };
  component.ledger = ledger;
  component.ngOnChanges({ ledger: new SimpleChange(null, ledger, true) });
  return { component, exportService };
}

describe('AccountLedgerComponent', () => {
  it('pagar seleccionadas emite solo las tildadas y suma su saldo', () => {
    const { component } = setup();
    const emitted: PendingDocument[][] = [];
    component.paySelected.subscribe(docs => emitted.push(docs));

    component.toggleSelected(component.ledger!.pending[1]); // el ledger se cargó en setup
    expect(component.selectedTotal).toBe(980000);
    component.paySelectedDocs();

    expect(emitted).toEqual([[component.ledger!.pending[1]]]); // idem
  });

  it('tildar todas y destildar todas', () => {
    const { component } = setup();
    component.toggleAll();
    expect(component.allSelected).toBeTrue();
    expect(component.selectedTotal).toBe(1305000);

    component.toggleAll();
    expect(component.selectedDocs).toEqual([]);
  });

  it('una seleccionada que ya se pagó deja de estar seleccionada al recargar', () => {
    const { component } = setup();
    component.toggleAll();

    const reloaded = { ...component.ledger!, pending: [doc('c2', 980000)] }; // el ledger se cargó en setup
    component.ledger = reloaded;
    component.ngOnChanges({ ledger: new SimpleChange(null, reloaded, false) });

    expect(component.selectedDocs.map(d => d.id)).toEqual(['c2']);
    expect(component.isSettled('c1')).toBeTrue();
    expect(component.isSettled('c2')).toBeFalse();
  });

  it('cambiar una fecha emite el filtro completo', () => {
    const { component } = setup();
    const emitted: LedgerQuery[] = [];
    component.queryChange.subscribe(q => emitted.push(q));
    component.query = { dateFrom: null, dateTo: '2026-10-23', includeCancelled: true };

    component.onDateChange('dateFrom', { target: { value: '2026-09-01' } } as unknown as Event);

    expect(emitted).toEqual([{ dateFrom: '2026-09-01', dateTo: '2026-10-23', includeCancelled: true }]);
  });

  it('anular respeta el permiso de cada cosa y no ofrece lo anulado ni lo cargado en la compra', () => {
    const { component } = setup();
    component.canCancelPayments = true;
    component.canCancelCreditNotes = false;

    expect(component.canCancelRow(row({}))).toBeTrue();
    expect(component.canCancelRow(row({ kind: 'credit_note', source: 'credit_note' }))).toBeFalse();
    expect(component.canCancelRow(row({ isCancelled: true }))).toBeFalse();
    expect(component.canCancelRow(row({ source: 'legacy' }))).toBeFalse();
    expect(component.canCancelRow(row({ kind: 'invoice', source: 'purchase' }))).toBeFalse();
  });

  it('las facturas abren el comprobante; pagos y notas se despliegan', () => {
    const { component } = setup();
    const pago = row({});

    expect(component.isExpandable(row({ kind: 'invoice', source: 'purchase' }))).toBeFalse();
    expect(component.isExpandable(row({ kind: 'credit_note', source: 'credit_note' }))).toBeTrue();
    component.toggle(pago);
    expect(component.isExpanded(pago)).toBeTrue();
    component.toggle(pago);
    expect(component.isExpanded(pago)).toBeFalse();
  });

  it('en tarjetas el importe va con signo: + suma deuda, − la baja', () => {
    const { component } = setup();
    expect(component.signedAmount(row({ debit: 1250000, credit: 0 }))).toBe('+ 1.250.000,00');
    expect(component.signedAmount(row({ debit: 0, credit: 900000 }))).toBe('− 900.000,00');
  });

  it('exporta lo que se está viendo', () => {
    const { component, exportService } = setup();
    component.exportExcel();
    expect(exportService.exportExcel).toHaveBeenCalledWith(component.ledger!, component.labels); // el ledger se cargó en setup
  });
});
