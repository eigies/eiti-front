import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import {
  DailySalesControlResponse,
  DailySalesControlRow,
  DailySalesPaymentItem
} from '../../../core/models/report.models';
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

// La búsqueda filtra solo en pantalla: los totales del back no la conocen, así que las tarjetas salen de las filas visibles.
describe('DailySalesControlComponent · tarjetas', () => {
  const response: DailySalesControlResponse = {
    rows: [
      sale('1', 'Mataderos', [2, 1], 1, 1000.5),
      sale('2', 'Mataderos', [1], 0, 500),
      sale('3', 'San Cristobal', [4], 1, 2000)
    ],
    totals: { salesCount: 3, unitsSold: 8, salesWithTradeIn: 2, totalAmount: 3500.5 }
  };

  let fixture: ComponentFixture<DailySalesControlComponent>;

  beforeEach(() => {
    const reports = jasmine.createSpyObj<ReportService>('ReportService', ['dailySalesControl']);
    reports.dailySalesControl.and.returnValue(of(response));

    TestBed.configureTestingModule({
      imports: [DailySalesControlComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: PdfBrandingService, useValue: {} },
        { provide: PdfLayoutService, useValue: {} }
      ]
    });
    fixture = TestBed.createComponent(DailySalesControlComponent);
    fixture.detectChanges();
  });

  it('sin búsqueda dan lo mismo que los totales del reporte', () => {
    expect(cards()).toEqual(['3', '8', '2', '$ 3.500,50']);
  });

  it('con búsqueda cuentan solo las ventas visibles', () => {
    fixture.componentInstance.filterForm.patchValue({ search: 'mataderos' });
    fixture.detectChanges();

    expect(cards()).toEqual(['2', '4', '1', '$ 1.500,50']);
  });

  it('si la búsqueda no encuentra nada quedan en cero', () => {
    fixture.componentInstance.filterForm.patchValue({ search: 'no existe' });
    fixture.detectChanges();

    expect(cards()).toEqual(['0', '0', '0', '$ 0,00']);
  });

  function cards(): string[] {
    return Array
      .from((fixture.nativeElement as HTMLElement).querySelectorAll('.daily-metric strong'))
      .map(card => card.textContent?.trim() ?? '');
  }

  function sale(
    saleId: string,
    branchName: string,
    quantities: number[],
    tradeIns: number,
    totalAmount: number
  ): DailySalesControlRow {
    return {
      saleId,
      code: `V-${saleId}`,
      createdAt: '2026-10-15T12:00:00Z',
      branchId: branchName,
      branchName,
      customerId: null,
      customerName: 'Consumidor final',
      statusCode: 2,
      status: 'Paid',
      isCuentaCorriente: false,
      totalAmount,
      products: quantities.map((quantity, index) => ({
        productId: `${saleId}-${index}`,
        code: '24KD',
        brand: 'Moura',
        name: 'Bateria',
        quantity,
        unitPrice: 100,
        totalAmount: 100 * quantity
      })),
      payments: [],
      tradeIns: Array.from({ length: tradeIns }, (_, index) => ({
        productId: `${saleId}-canje-${index}`,
        code: 'CANJE',
        brand: 'Usada',
        name: 'Bateria usada',
        quantity: 1,
        amount: 10
      }))
    };
  }
});
