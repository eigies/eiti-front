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

describe('CustomerAccountComponent · notas de crédito', () => {
  function setup() {
    const accountService = jasmine.createSpyObj<CustomerAccountService>(
      'CustomerAccountService',
      ['getAccount', 'addPayment', 'cancelPayment', 'getPaymentLink', 'createCreditNote', 'cancelCreditNote']
    );
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
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['getSaleById']);
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

    return { component, accountService, toast, confirmation, auth };
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

    await component.cancelCreditNote({
      id: 'nc-1', code: 'NCC-001', amount: 30000, type: 'nota_credito'
    } as never);

    expect(confirmation.confirm).toHaveBeenCalled();
    expect(accountService.cancelCreditNote).not.toHaveBeenCalled();
  });

  it('anular con confirmación llama al servicio', async () => {
    const { component, accountService, toast } = setup();

    await component.cancelCreditNote({
      id: 'nc-1', code: 'NCC-001', amount: 30000, type: 'nota_credito'
    } as never);

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
});
