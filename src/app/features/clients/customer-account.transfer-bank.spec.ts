import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { BankResponse } from '../../core/models/bank.models';
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

const TRANSFER = 2;

function bank(id: number, name: string, useForTransfer: boolean, active = true): BankResponse {
  return { id, name, active, useForCard: !useForTransfer, useForTransfer, useForCheque: false, plans: [] };
}

describe('CustomerAccountComponent · banco receptor del cobro por transferencia', () => {
  function setup(bankList: BankResponse[]) {
    const accountService = jasmine.createSpyObj<CustomerAccountService>(
      'CustomerAccountService',
      ['getAccount', 'addPayment', 'cancelPayment', 'getPaymentLink', 'createCreditNote', 'cancelCreditNote']
    );
    accountService.getAccount.and.returnValue(of({
      customerId: 'cust-1', customerName: 'Juan Perez', phone: null, email: null,
      deudaTotal: 100000, cobradoTotal: 0, saldoPendiente: 100000, saldoAFavor: 0, movements: []
    }) as never);
    accountService.addPayment.and.returnValue(of({ paymentId: 'p-1', customerId: 'cust-1', amount: 5000 }) as never);

    const banks = jasmine.createSpyObj<BankService>('BankService', ['listBanks']);
    banks.listBanks.and.returnValue(of(bankList));
    const branches = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
    branches.listBranches.and.returnValue(of([]));
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['getSaleById']);
    const remito = jasmine.createSpyObj<RemitoPdfService>('RemitoPdfService', ['generate']);
    const receipt = jasmine.createSpyObj<PaymentReceiptPdfService>('PaymentReceiptPdfService', ['generate']);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);
    const confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    const route = { snapshot: { paramMap: { get: () => 'cust-1' } } } as unknown as ActivatedRoute;

    const component = new CustomerAccountComponent(
      accountService, banks, branches, sales, remito, receipt,
      auth, toast, route, cdr, confirmation
    );
    component.ngOnInit();
    component.onMethodChange(TRANSFER);
    component.newAmount = 5000;

    return { component, accountService };
  }

  it('ofrece solo los bancos activos habilitados para transferencia', () => {
    const { component } = setup([
      bank(3, 'Mercadopago', true),
      bank(5, 'Solo tarjetas', false),
      bank(6, 'Inactivo', true, false)
    ]);
    expect(component.transferBankOptions.map(o => o.value)).toEqual([3]);
  });

  it('exige elegir el banco cuando la empresa tiene bancos de transferencia', () => {
    const { component } = setup([bank(3, 'Mercadopago', true)]);
    expect(component.canSubmitPayment).toBeFalse();
    component.onTransferBankChange(3);
    expect(component.canSubmitPayment).toBeTrue();
  });

  it('no bloquea el cobro si la empresa no tiene bancos de transferencia cargados', () => {
    const { component } = setup([]);
    expect(component.canSubmitPayment).toBeTrue();
  });

  it('manda el banco elegido como transferBankId', () => {
    const { component, accountService } = setup([bank(3, 'Mercadopago', true)]);
    component.onTransferBankChange(3);
    component.submitPayment();
    expect(accountService.addPayment.calls.mostRecent().args[1].transferBankId).toBe(3);
  });

  it('cambiar de método limpia el banco de transferencia', () => {
    const { component, accountService } = setup([bank(3, 'Mercadopago', true)]);
    component.onTransferBankChange(3);
    component.onMethodChange(1);
    component.submitPayment();
    expect(accountService.addPayment.calls.mostRecent().args[1].transferBankId).toBeNull();
  });
});
