import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CcCancelRefundMode } from '../../../core/models/sale.models';
import { CcCancelRefundOptionsComponent } from './cc-cancel-refund-options.component';

describe('CcCancelRefundOptionsComponent', () => {
  let fixture: ComponentFixture<CcCancelRefundOptionsComponent>;
  let component: CcCancelRefundOptionsComponent;

  const options = (): HTMLLabelElement[] => Array.from(fixture.nativeElement.querySelectorAll('.cancel-opt'));
  const radios = (): HTMLInputElement[] => Array.from(fixture.nativeElement.querySelectorAll('input[type="radio"]'));

  beforeEach(() => {
    fixture = TestBed.createComponent(CcCancelRefundOptionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('paidTotal', 50000);
    fixture.detectChanges();
  });

  it('muestra lo cobrado y las dos opciones, con saldo a favor elegido', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Monto ya cobrado');
    expect(text).toContain('50,000.00');
    expect(options().map(option => option.querySelector('.cancel-opt__title')?.textContent?.trim()))
      .toEqual(['Dejar saldo a favor', 'Anular los pagos']);
    expect(options()[0].classList).toContain('cancel-opt--active');
    expect(radios()[0].checked).toBeTrue();
  });

  it('al elegir "Anular los pagos" avisa el modo nuevo y lo marca', () => {
    const emitted: CcCancelRefundMode[] = [];
    component.modeChange.subscribe(mode => emitted.push(mode));

    radios()[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual([CcCancelRefundMode.ReversePayments]);
    expect(options()[1].classList).toContain('cancel-opt--active');
    expect(options()[0].classList).not.toContain('cancel-opt--active');
  });

  it('los radios de cada instancia forman su propio grupo', () => {
    const other = TestBed.createComponent(CcCancelRefundOptionsComponent);
    other.componentRef.setInput('paidTotal', 1);
    other.detectChanges();

    const otherName = (other.nativeElement.querySelector('input[type="radio"]') as HTMLInputElement).name;
    expect(radios()[0].name).not.toBe(otherName);
  });
});
