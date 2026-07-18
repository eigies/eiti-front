import { FormBuilder } from '@angular/forms';
import { CashComponent } from './cash.component';

describe('CashComponent payroll movement labels', () => {
  function createComponent(): CashComponent {
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
});
