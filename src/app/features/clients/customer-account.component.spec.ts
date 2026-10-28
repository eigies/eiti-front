import { SaleFiscalReceiversResponse } from '../../core/models/sale.models';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BankService } from '../../core/services/bank.service';
import { BranchService } from '../../core/services/branch.service';
import { CustomerAccountService } from '../../core/services/customer-account.service';
import { SaleService } from '../../core/services/sale.service';
import { PaymentReceiptPdfService } from '../../shared/services/payment-receipt-pdf.service';
import { RemitoPdfService } from '../../shared/services/remito-pdf.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ToastService } from '../../shared/services/toast.service';
import { CustomerAccountComponent } from './customer-account.component';
import { AccountLedger, LedgerRow } from '../../core/models/account-ledger.models';

const EMPTY_LEDGER: AccountLedger = {
  accountId: 'cust-1', accountName: 'Juan Perez', dateFrom: null, dateTo: null,
  openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, rows: [], pending: []
};

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    kind: 'payment', source: 'receipt', id: 'rc-1', date: '2026-10-02T00:00:00', code: 'RC-0003',
    document: null, description: 'Recibo', debit: 0, credit: 30000, balance: 0, isCancelled: false,
    means: [], imputations: [], ...partial
  };
}

describe('CustomerAccountComponent · notas de crédito', () => {
  function setup() {
    const accountService = jasmine.createSpyObj<CustomerAccountService>(
      'CustomerAccountService',
      ['getAccount', 'getLedger', 'addPayment', 'cancelPayment', 'createReceipt', 'cancelReceipt',
        'getPaymentLink', 'createCreditNote', 'cancelCreditNote']
    );
    accountService.getLedger.and.returnValue(of(EMPTY_LEDGER));
    accountService.cancelReceipt.and.returnValue(of(void 0));
    accountService.cancelPayment.and.returnValue(of(void 0));
    accountService.createReceipt.and.returnValue(of({
      receiptId: 'rc-1', code: 'RC-0003', customerId: 'cust-1', totalAmount: 325000, paymentIds: ['p1', 'p2'],
      appliedToSales: 300000, creditAdded: 25000, customerCreditBalance: 25000,
      imputaciones: [{ saleId: 's1', code: 'VENT-0101', amount: 300000 }]
    }));
    accountService.getAccount.and.returnValue(of({
      customerId: 'cust-1',
      customerName: 'Juan Perez',
      phone: null,
      email: null,
      deudaTotal: 100000,
      cobradoTotal: 0,
      saldoPendiente: 70000,
      saldoAFavor: 0,
      movements: []
    }) as never);
    accountService.createCreditNote.and.returnValue(of({
      id: 'nc-1', code: 'NCC-001', amount: 30000, imputaciones: [], sobrante: 0
    }));
    accountService.cancelCreditNote.and.returnValue(of(void 0));

    const banks = jasmine.createSpyObj<BankService>('BankService', ['listBanks']);
    banks.listBanks.and.returnValue(of([]));
    const branches = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
    branches.listBranches.and.returnValue(of([]));
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['getSaleById', 'cancelSale', 'getFiscalReceivers']);
    sales.getSaleById.and.returnValue(of({ id: 'sale-1', details: [] }) as never);
    const remito = jasmine.createSpyObj<RemitoPdfService>('RemitoPdfService', ['generate']);
    const receipt = jasmine.createSpyObj<PaymentReceiptPdfService>('PaymentReceiptPdfService', ['generate']);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);
    const confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    confirmation.confirm.and.resolveTo(true);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    const route = { snapshot: { paramMap: { get: () => 'cust-1' } } } as unknown as ActivatedRoute;

    const component = new CustomerAccountComponent(
      accountService, banks, branches, sales, remito, receipt,
      auth, toast, route, cdr, confirmation
    );
    component.ngOnInit();

    return { component, accountService, toast, confirmation, auth, banks, sales };
  }

  // El motivo es la única trazabilidad de un ajuste sin documento de origen:
  // sin él la NC no se puede emitir.
  it('no permite emitir sin motivo', () => {
    const { component, accountService } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = '   ';

    expect(component.canSubmitCreditNote).toBeFalse();

    component.submitCreditNote();
    expect(accountService.createCreditNote).not.toHaveBeenCalled();
  });

  it('no permite emitir con importe cero', () => {
    const { component } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 0;
    component.ncReason = 'Bonificación';

    expect(component.canSubmitCreditNote).toBeFalse();
  });

  it('emite la nota con los datos del formulario', () => {
    const { component, accountService, toast } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = '  Bonificación acordada  ';
    component.ncDate = '2026-09-05';
    component.ncSaleId = 'sale-1';

    component.submitCreditNote();

    expect(accountService.createCreditNote).toHaveBeenCalledWith('cust-1', {
      amount: 30000,
      reason: 'Bonificación acordada',
      date: '2026-09-05',
      saleId: 'sale-1'
    });
    expect(toast.success).toHaveBeenCalledWith('Nota de crédito NCC-001 emitida');
    expect(component.showCreditNoteForm).toBeFalse();
  });

  it('sin venta elegida manda saleId en null', () => {
    const { component, accountService } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = 'Bonificación';
    component.ncDate = '2026-09-05';
    component.ncSaleId = '';

    component.submitCreditNote();

    expect(accountService.createCreditNote.calls.mostRecent().args[1].saleId).toBeNull();
  });

  it('la fecha por defecto es la local, no la UTC', () => {
    const { component } = setup();
    component.toggleCreditNoteForm();

    expect(component.ncDate).toBe(new Date().toLocaleDateString('en-CA'));
  });

  // Anular puede dejar ventas impagas otra vez: nunca sin confirmar.
  it('anular pide confirmación y respeta el no', async () => {
    const { component, accountService, confirmation } = setup();
    confirmation.confirm.and.resolveTo(false);

    await component.cancelRow(row({ kind: 'credit_note', source: 'credit_note', id: 'nc-1', code: 'NCC-001', credit: 30000 }));

    expect(confirmation.confirm).toHaveBeenCalled();
    expect(accountService.cancelCreditNote).not.toHaveBeenCalled();
  });

  it('anular con confirmación llama al servicio', async () => {
    const { component, accountService, toast } = setup();

    await component.cancelRow(row({ kind: 'credit_note', source: 'credit_note', id: 'nc-1', code: 'NCC-001', credit: 30000 }));

    expect(accountService.cancelCreditNote).toHaveBeenCalledWith('cust-1', 'nc-1');
    expect(toast.success).toHaveBeenCalledWith('Nota de crédito anulada');
  });

  it('un error del backend se muestra al usuario y no deja el botón trabado', () => {
    const { component, accountService, toast } = setup();
    accountService.createCreditNote.and.returnValue(
      throwError(() => ({ error: { detail: 'No hay una sesión de caja abierta.' } })));

    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = 'Bonificación';
    component.ncDate = '2026-09-05';
    component.submitCreditNote();

    expect(toast.error).toHaveBeenCalledWith('No hay una sesión de caja abierta.');
    expect(component.addingCreditNote).toBeFalse();
  });

  // ── Recibo con varios medios ─────────────────────────────

  // El modal no deja confirmar mientras banksLoading: tiene que apagarse cuando llegan los bancos.
  it('cuando llegan los bancos deja de bloquear el cobro', () => {
    const { component, banks } = setup();
    expect(banks.listBanks).toHaveBeenCalled();
    expect(component.banksLoading).toBeFalse();
  });

  it('registra el recibo con tarjeta, cheque recibido y banco de la transferencia', () => {
    const { component, accountService, toast } = setup();
    component.openPayment();

    component.submitReceipt({
      date: '2026-10-23',
      notes: null,
      lines: [
        { method: 3, amount: 200000, reference: null, chequeId: null, cardBankId: 7, cardCuotas: 3, transferBankId: null, cheque: null },
        { method: 2, amount: 100000, reference: 'Ref. 1', chequeId: null, cardBankId: null, cardCuotas: null, transferBankId: 3, cheque: null },
        {
          method: 4, amount: 25000, reference: null, chequeId: null, cardBankId: null, cardCuotas: null, transferBankId: null,
          cheque: { bankId: 1, numero: '00045120', titular: 'Ferretería Sur', cuitDni: '30712345678', monto: 25000, fechaEmision: '2026-10-01', fechaVencimiento: '2026-11-10', notas: null }
        }
      ]
    });

    const req = accountService.createReceipt.calls.mostRecent().args[1];
    expect(req.lines.map(l => l.method)).toEqual([3, 2, 4]);
    expect(req.lines[0].cardBankId).toBe(7);
    expect(req.lines[0].cardCuotas).toBe(3);
    expect(req.lines[1].transferBankId).toBe(3);
    expect(req.lines[2].cheque?.numero).toBe('00045120');
    expect(component.paymentOpen).toBeFalse();
    expect(toast.success.calls.mostRecent().args[0]).toContain('RC-0003');
    expect(toast.success.calls.mostRecent().args[0]).toContain('Saldo a favor');
  });

  it('anular un recibo lo anula entero; un cobro sin recibo, por su endpoint', async () => {
    const { component, accountService } = setup();

    await component.cancelRow(row({ source: 'receipt', id: 'rc-1' }));
    await component.cancelRow(row({ source: 'payment', id: 'pay-1', code: null }));

    expect(accountService.cancelReceipt).toHaveBeenCalledWith('cust-1', 'rc-1');
    expect(accountService.cancelPayment).toHaveBeenCalledWith('cust-1', 'pay-1');
  });

  it('la venta del extracto abre el detalle de la venta', () => {
    const { component } = setup();
    component.openDetalle('sale-1');
    expect(component.detalleModalOpen).toBeTrue();
  });

  // Mismo control que en gestión de venta: la NC va al CUIT de la factura y el usuario lo ve antes de anular.
  it('anular una venta facturada a otro CUIT muestra los dos y reenvia confirmando', async () => {
    const { component, sales, confirmation } = setup();
    sales.cancelSale.and.returnValues(
      throwError(() => ({ error: { errorCode: 'Sales.Cancel.InvoiceReceiverChanged' } })),
      of(void 0));
    const receivers: SaleFiscalReceiversResponse = {
      available: true,
      unavailableReason: null,
      invoice: { document: 'Factura A 00010-00000039', name: 'TRANSPORTE OLIVOS S.A -', vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-68225650-4' },
      customer: { document: null, name: 'TRANSPORTE OLIVOS S.A -', vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-51743143-1' },
      customerMatchesInvoice: false,
      creditNote: null,
      creditNoteMatchesInvoice: true,
      regularizationStep: 'none',
      debitNote: null
    };
    sales.getFiscalReceivers.and.returnValue(of(receivers));
    component.detalleModalSale = { id: 'sale-1', ccPaidTotal: 0, details: [] } as never;

    component.confirmCancelSale();
    await new Promise(resolve => setTimeout(resolve));

    expect(confirmation.confirm.calls.mostRecent().args[0].confirmLabel?.replace(/⁠/g, '')).toBe('Anular y emitir la NC a CUIT 30-68225650-4');
    expect(sales.cancelSale.calls.allArgs()).toEqual([
      ['sale-1', undefined, false],
      ['sale-1', undefined, true]
    ]);
  });
});
