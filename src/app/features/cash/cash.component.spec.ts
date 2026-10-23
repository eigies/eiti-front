import { FormBuilder } from '@angular/forms';
import { CashSessionMovementResponse, CashSessionResponse } from '../../core/models/cash.models';
import { CashComponent } from './cash.component';

describe('CashComponent payroll movement labels', () => {
  function createComponent(): CashComponent {
    // Orden del constructor de CashComponent: fb, branch, cash, sale, customerAccount, bank,
    // purchase, toast, confirmation, onboarding, router, pdfBranding, pdfLayout,
    // paymentReceiptPdf, auth. Solo auth se usa en estos tests.
    return new CashComponent(
      new FormBuilder(),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { hasPermission: () => true } as never
    );
  }

  it('translates payroll cash movement type names to Spanish labels', () => {
    const component = createComponent();

    expect(component.translateType('PayrollExpense')).toBe('Pago de sueldo');
    expect(component.translateType('PayrollExpenseCancellation')).toBe('Anulación pago sueldo');
    expect(component.translateType('PayrollAdvanceExpense')).toBe('Adelanto de sueldo');
    expect(component.translateType('PayrollAdvanceExpenseCancellation')).toBe('Anulación adelanto sueldo');
  });

  // Antes el cobro de cuenta corriente no guardaba el banco y el cierre de caja nunca lo sumaba.
  describe('transferencias de cobros de cuenta corriente', () => {
    function movement(partial: Partial<CashSessionMovementResponse>): CashSessionMovementResponse {
      return {
        id: 'm', type: 0, typeName: 'TransferIncome', direction: 0, directionName: 'None', amount: 0,
        occurredAt: '2026-10-23T12:00:00Z', description: 'Cobro cliente - transferencia', referenceType: 'CustomerPayment',
        referenceId: null, customerPaymentId: null, transferBankId: null, ...partial
      };
    }

    function session(movements: CashSessionMovementResponse[]): CashSessionResponse {
      return { movements } as CashSessionResponse;
    }

    it('el desglose por banco suma los cobros por transferencia y resta los anulados', () => {
      const component = createComponent();
      component.bankNamesById = new Map([[3, 'Mercadopago'], [5, 'Galicia']]);

      const breakdown = component.computeTransferBankBreakdown(session([
        movement({ id: 'a', amount: 50000, referenceId: 'cp-1', customerPaymentId: 'cp-1', transferBankId: 3 }),
        movement({ id: 'b', amount: 20000, referenceId: 'cp-2', customerPaymentId: 'cp-2', transferBankId: 5 }),
        movement({ id: 'c', typeName: 'CuentaCorrienteCancellation', amount: 20000, referenceId: 'cp-2', customerPaymentId: 'cp-2', transferBankId: 5 }),
        movement({ id: 'd', typeName: 'CuentaCorrienteIncome', amount: 10000, referenceId: 'cp-3', customerPaymentId: 'cp-3' })
      ]));

      expect(breakdown).toEqual([{ bankName: 'Mercadopago', amount: 50000 }]);
    });

    it('el renglón del cobro en caja dice a qué banco entró', () => {
      const component = createComponent();
      component.bankNamesById = new Map([[3, 'Mercadopago']]);

      const rows = component.getDisplayRows(session([
        movement({ id: 'a', amount: 50000, referenceId: 'cp-1', customerPaymentId: 'cp-1', paymentMethod: 2, transferBankId: 3 })
      ]));

      expect(rows[0].paymentMethodLabel).toBe('Transferencia - Mercadopago');
    });
  });
});
