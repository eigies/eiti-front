import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseService } from '../../core/services/purchase.service';
import { SupplierAccountService } from '../../core/services/supplier-account.service';
import { PaymentReceiptPdfService } from '../../shared/services/payment-receipt-pdf.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ToastService } from '../../shared/services/toast.service';
import { SupplierAccountComponent } from './supplier-account.component';
import { AccountLedger, LedgerRow } from '../../core/models/account-ledger.models';

const EMPTY_LEDGER: AccountLedger = {
  accountId: 'sup-1', accountName: 'Proveedor SA', dateFrom: null, dateTo: null,
  openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, rows: [], pending: []
};

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    kind: 'payment', source: 'payment_order', id: 'op-1', date: '2026-10-02T00:00:00', code: 'OP-0004',
    document: null, description: 'Orden de pago', debit: 0, credit: 30000, balance: 0, isCancelled: false,
    means: [], imputations: [], ...partial
  };
}

describe('SupplierAccountComponent · notas de crédito', () => {
  function setup() {
    const accountService = jasmine.createSpyObj<SupplierAccountService>(
      'SupplierAccountService',
      ['getAccount', 'getLedger', 'listAccounts', 'addPayment', 'cancelPayment', 'createPaymentOrder',
        'cancelPaymentOrder', 'createCreditNote', 'cancelCreditNote']
    );
    accountService.getLedger.and.returnValue(of(EMPTY_LEDGER));
    accountService.getAccount.and.returnValue(of({
      supplierId: 'sup-1',
      supplierName: 'Proveedor SA',
      phone: null,
      email: null,
      deudaTotal: 100000,
      pagadoTotal: 0,
      saldoPendiente: 70000,
      saldoAFavor: 0,
      movements: []
    }) as never);
    accountService.createCreditNote.and.returnValue(of({
      id: 'nc-1', code: 'NCP-001', amount: 30000, imputaciones: [], sobrante: 0
    }));
    accountService.cancelCreditNote.and.returnValue(of(void 0));

    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);
    const purchases = jasmine.createSpyObj<PurchaseService>('PurchaseService', ['listCarteraCheques']);
    purchases.listCarteraCheques.and.returnValue(of([]) as never);
    const receipt = jasmine.createSpyObj<PaymentReceiptPdfService>('PaymentReceiptPdfService', ['generate']);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    confirmation.confirm.and.resolveTo(true);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    const route = { snapshot: { paramMap: { get: () => 'sup-1' } } } as unknown as ActivatedRoute;

    const component = new SupplierAccountComponent(
      accountService, auth, purchases, receipt, toast, route, router, cdr, confirmation
    );
    component.ngOnInit();

    return { component, accountService, toast, confirmation, purchases };
  }

  // El motivo es la única trazabilidad de un ajuste sin documento de origen.
  it('no permite registrar sin motivo', () => {
    const { component, accountService } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = '   ';

    expect(component.canSubmitCreditNote).toBeFalse();

    component.submitCreditNote();
    expect(accountService.createCreditNote).not.toHaveBeenCalled();
  });

  it('registra la nota con los datos del formulario', () => {
    const { component, accountService, toast } = setup();
    component.toggleCreditNoteForm();
    component.ncAmount = 30000;
    component.ncReason = '  Bonificación del proveedor  ';
    component.ncDate = '2026-09-05';
    component.ncPurchaseId = 'comp-1';

    component.submitCreditNote();

    expect(accountService.createCreditNote).toHaveBeenCalledWith('sup-1', {
      amount: 30000,
      reason: 'Bonificación del proveedor',
      date: '2026-09-05',
      purchaseId: 'comp-1'
    });
    expect(toast.success).toHaveBeenCalledWith('Nota de crédito NCP-001 registrada');
    expect(component.showCreditNoteForm).toBeFalse();
  });

  it('la fecha por defecto es la local, no la UTC', () => {
    const { component } = setup();
    component.toggleCreditNoteForm();

    expect(component.ncDate).toBe(new Date().toLocaleDateString('en-CA'));
  });

  // Anular puede dejar compras impagas otra vez: nunca sin confirmar.
  it('anular pide confirmación y respeta el no', async () => {
    const { component, accountService, confirmation } = setup();
    confirmation.confirm.and.resolveTo(false);

    await component.cancelRow(row({ kind: 'credit_note', source: 'credit_note', id: 'nc-1', code: 'NCP-001', credit: 30000 }));

    expect(confirmation.confirm).toHaveBeenCalled();
    expect(accountService.cancelCreditNote).not.toHaveBeenCalled();
  });

  it('anular con confirmación llama al servicio', async () => {
    const { component, accountService, toast } = setup();

    await component.cancelRow(row({ kind: 'credit_note', source: 'credit_note', id: 'nc-1', code: 'NCP-001', credit: 30000 }));

    expect(accountService.cancelCreditNote).toHaveBeenCalledWith('sup-1', 'nc-1');
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
});

describe('SupplierAccountComponent · extracto y orden de pago', () => {
  function setup() {
    const accountService = jasmine.createSpyObj<SupplierAccountService>(
      'SupplierAccountService',
      ['getAccount', 'getLedger', 'listAccounts', 'addPayment', 'cancelPayment', 'createPaymentOrder',
        'cancelPaymentOrder', 'createCreditNote', 'cancelCreditNote']
    );
    accountService.getAccount.and.returnValue(of({
      supplierId: 'sup-1', supplierName: 'Proveedor SA', phone: null, email: null,
      deudaTotal: 100000, pagadoTotal: 0, saldoPendiente: 70000, saldoAFavor: 0, movements: []
    }) as never);
    accountService.getLedger.and.returnValue(of(EMPTY_LEDGER));
    accountService.createPaymentOrder.and.returnValue(of({
      paymentOrderId: 'op-1', code: 'OP-0004', supplierId: 'sup-1', totalAmount: 750000, paymentIds: ['p1', 'p2'],
      appliedToPurchases: 750000, creditAdded: 0, supplierCreditBalance: 0,
      imputaciones: [{ purchaseId: 'c1', code: 'COMP-0112', invoiceNumber: null, amount: 750000 }]
    }));
    accountService.cancelPaymentOrder.and.returnValue(of(void 0));
    accountService.cancelPayment.and.returnValue(of(void 0));

    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);
    const purchases = jasmine.createSpyObj<PurchaseService>('PurchaseService', ['listCarteraCheques']);
    purchases.listCarteraCheques.and.returnValue(of([]) as never);
    const receipt = jasmine.createSpyObj<PaymentReceiptPdfService>('PaymentReceiptPdfService', ['generate']);
    receipt.generate.and.resolveTo();
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    confirmation.confirm.and.resolveTo(true);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    const route = { snapshot: { paramMap: { get: () => 'sup-1' } } } as unknown as ActivatedRoute;

    const component = new SupplierAccountComponent(
      accountService, auth, purchases, receipt, toast, route, router, cdr, confirmation
    );
    component.ngOnInit();
    return { component, accountService, toast, confirmation, purchases, receipt };
  }

  it('carga el extracto con el filtro actual y lo recarga al cambiarlo', () => {
    const { component, accountService } = setup();
    expect(accountService.getLedger).toHaveBeenCalledWith('sup-1', { dateFrom: null, dateTo: null, includeCancelled: false });

    component.onLedgerQueryChange({ dateFrom: '2026-09-01', dateTo: null, includeCancelled: true });

    expect(accountService.getLedger.calls.mostRecent().args).toEqual(
      ['sup-1', { dateFrom: '2026-09-01', dateTo: null, includeCancelled: true }]);
  });

  it('pagar las pendientes seleccionadas abre el modal con ese objetivo y carga la cartera', () => {
    const { component, purchases } = setup();
    component.openPayment([
      { id: 'c1', date: '', code: 'COMP-0118', document: null, total: 640000, imputed: 315000, pending: 325000, ageDays: 28 },
      { id: 'c2', date: '', code: 'COMP-0125', document: null, total: 980000, imputed: 0, pending: 980000, ageDays: 9 }
    ]);

    expect(component.paymentOpen).toBeTrue();
    expect(component.paymentTarget).toBe(1305000);
    expect(purchases.listCarteraCheques).toHaveBeenCalled();
  });

  it('registra la orden con todos sus medios y avisa a qué se imputó', () => {
    const { component, accountService, toast } = setup();
    component.openPayment();

    component.submitPaymentOrder({
      date: '2026-10-23',
      notes: 'Pago septiembre',
      lines: [
        { method: 3, amount: 400000, reference: null, chequeId: 'ch-1', cardBankId: null, cardCuotas: null, transferBankId: null, cheque: null },
        { method: 2, amount: 350000, reference: 'Ref. 99120', chequeId: null, cardBankId: null, cardCuotas: null, transferBankId: null, cheque: null }
      ]
    });

    expect(accountService.createPaymentOrder).toHaveBeenCalledWith('sup-1', {
      date: '2026-10-23',
      notes: 'Pago septiembre',
      lines: [
        { method: 3, amount: 400000, chequeId: 'ch-1', reference: null },
        { method: 2, amount: 350000, chequeId: null, reference: 'Ref. 99120' }
      ]
    });
    expect(component.paymentOpen).toBeFalse();
    expect(toast.success.calls.mostRecent().args[0]).toContain('OP-0004');
    expect(toast.success.calls.mostRecent().args[0]).toContain('COMP-0112');
  });

  it('si el backend rechaza la orden, el modal sigue abierto y se muestra el motivo', () => {
    const { component, accountService, toast } = setup();
    accountService.createPaymentOrder.and.returnValue(
      throwError(() => ({ error: { detail: 'El cheque seleccionado no está en cartera.' } })));
    component.openPayment();

    component.submitPaymentOrder({ date: '2026-10-23', notes: null, lines: [] });

    expect(toast.error).toHaveBeenCalledWith('El cheque seleccionado no está en cartera.');
    expect(component.paymentOpen).toBeTrue();
    expect(component.submittingPayment).toBeFalse();
  });

  it('anular una orden de pago la anula entera; un pago sin orden, por su endpoint', async () => {
    const { component, accountService } = setup();

    await component.cancelRow(row({ source: 'payment_order', id: 'op-1' }));
    await component.cancelRow(row({ source: 'payment', id: 'pay-1', code: null }));

    expect(accountService.cancelPaymentOrder).toHaveBeenCalledWith('sup-1', 'op-1');
    expect(accountService.cancelPayment).toHaveBeenCalledWith('sup-1', 'pay-1');
  });

  it('anular un pago avisa qué vuelve a pendiente y qué cheques vuelven a cartera', async () => {
    const { component, confirmation } = setup();

    await component.cancelRow(row({
      means: [
        { paymentId: 'p1', method: 'check', methodLabel: 'Cheque', amount: 1, reference: null, chequeNumber: '1', bankName: null, dueDate: null, cardInstallments: null, cardSurcharge: null },
        { paymentId: 'p2', method: 'check', methodLabel: 'Cheque', amount: 1, reference: null, chequeNumber: '2', bankName: null, dueDate: null, cardInstallments: null, cardSurcharge: null }
      ],
      imputations: [{ documentId: 'c1', code: 'COMP-0112', document: null, amount: 2 }]
    }));

    const options = confirmation.confirm.calls.mostRecent().args[0];
    expect(options.detail).toContain('COMP-0112');
    expect(options.detail).toContain('Los 2 cheques vuelven a cartera');
  });

  it('imprime la orden con su número y cada medio', () => {
    const { component, receipt } = setup();

    component.printRow(row({
      credit: 750000,
      means: [
        { paymentId: 'p1', method: 'check', methodLabel: 'Cheque', amount: 400000, reference: null, chequeNumber: '00045120', bankName: 'Macro', dueDate: '2026-11-10T00:00:00', cardInstallments: null, cardSurcharge: null },
        { paymentId: 'p2', method: 'cash', methodLabel: 'Efectivo', amount: 350000, reference: null, chequeNumber: null, bankName: null, dueDate: null, cardInstallments: null, cardSurcharge: null }
      ],
      imputations: [{ documentId: 'c1', code: 'COMP-0112', document: 'A 0003-1', amount: 750000 }]
    }));

    const data = receipt.generate.calls.mostRecent().args[0];
    expect(data.documentCode).toBe('OP-0004');
    expect(data.means?.map(m => m.detail)).toEqual(['Nº 00045120 · Macro · vto 10/11', '—']);
    expect(data.coverage).toEqual([{ code: 'COMP-0112 (Fact. A 0003-1)', amount: 750000 }]);
    expect(data.creditAdded).toBe(0);
  });
});
