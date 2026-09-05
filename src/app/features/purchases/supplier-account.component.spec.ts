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

describe('SupplierAccountComponent · notas de crédito', () => {
  function setup() {
    const accountService = jasmine.createSpyObj<SupplierAccountService>(
      'SupplierAccountService',
      ['getAccount', 'listAccounts', 'addPayment', 'cancelPayment', 'createCreditNote', 'cancelCreditNote']
    );
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

    return { component, accountService, toast, confirmation };
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

    await component.cancelCreditNote({
      id: 'nc-1', code: 'NCP-001', amount: 30000, type: 'nota_credito'
    } as never);

    expect(confirmation.confirm).toHaveBeenCalled();
    expect(accountService.cancelCreditNote).not.toHaveBeenCalled();
  });

  it('anular con confirmación llama al servicio', async () => {
    const { component, accountService, toast } = setup();

    await component.cancelCreditNote({
      id: 'nc-1', code: 'NCP-001', amount: 30000, type: 'nota_credito'
    } as never);

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
