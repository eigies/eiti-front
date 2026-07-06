import { FormBuilder } from '@angular/forms';
import { DailySalesPaymentItem } from '../../../core/models/report.models';
import { ReportService } from '../../../core/services/report.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DailySalesControlComponent } from './daily-sales-control.component';

describe('DailySalesControlComponent payment breakdown', () => {
  let component: DailySalesControlComponent;

  beforeEach(() => {
    component = new DailySalesControlComponent(
      new FormBuilder(),
      {} as ReportService,
      {} as ToastService,
      {} as PdfBrandingService,
      {} as PdfLayoutService
    );
  });

  it('keeps the existing payment text when there is only one method', () => {
    const payments = [payment(1, 99_000, 'CAJA-1')];

    expect(component.hasCombinedPayments(payments)).toBeFalse();
    expect(component.paymentsText(payments)).not.toContain('$');
    expect(component.paymentsText(payments)).toContain('Ref. CAJA-1');
  });

  it('splits combined payments into one line with amount per method', () => {
    const payments = [
      payment(1, 90_000),
      payment(2, 9_000, 'TR-10')
    ];

    expect(component.hasCombinedPayments(payments)).toBeTrue();
    expect(component.paymentsText(payments).split('\n')).toEqual([
      'Efectivo · $ 90.000,00',
      'Transferencia · $ 9.000,00 · Ref. TR-10'
    ]);
  });

  function payment(methodCode: number, amount: number, reference: string | null = null): DailySalesPaymentItem {
    return {
      methodCode,
      method: '',
      amount,
      reference
    };
  }
});
