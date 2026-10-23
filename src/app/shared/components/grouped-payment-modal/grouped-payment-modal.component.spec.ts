import { FormBuilder } from '@angular/forms';
import { BankResponse } from '../../../core/models/bank.models';
import { CarteraChequeOption } from '../../../core/models/cheque.models';
import { GroupedPaymentSubmit, PendingDocument } from '../../../core/models/account-ledger.models';
import { GroupedPaymentModalComponent, GroupedPaymentMode } from './grouped-payment-modal.component';

const CASH = 1;
const TRANSFER = 2;
const SUPPLIER_CHECK = 3;
const CUSTOMER_CARD = 3;
const CUSTOMER_CHECK = 4;

const pending: PendingDocument[] = [
  { id: 'c1', date: '2026-09-25T00:00:00', code: 'COMP-0118', document: null, total: 640000, imputed: 315000, pending: 325000, ageDays: 28 },
  { id: 'c2', date: '2026-10-14T00:00:00', code: 'COMP-0125', document: null, total: 980000, imputed: 0, pending: 980000, ageDays: 9 }
];

const cheques: CarteraChequeOption[] = [
  { id: 'ch-1', numero: '00045120', titular: 'Ferretería Sur', cuitDni: '30712345678', monto: 400000, bankId: 1, bankName: 'Macro', fechaVencimiento: '2026-11-10T00:00:00' },
  { id: 'ch-2', numero: '00045133', titular: 'Corralón Oeste', cuitDni: '30798765432', monto: 280000, bankId: 2, bankName: 'BBVA', fechaVencimiento: '2026-11-18T00:00:00' }
];

function bank(id: number, name: string, opts: Partial<BankResponse> = {}): BankResponse {
  return { id, name, active: true, useForCard: false, useForTransfer: false, useForCheque: false, plans: [], ...opts };
}

function setup(mode: GroupedPaymentMode, extra: Partial<GroupedPaymentModalComponent> = {}) {
  const component = new GroupedPaymentModalComponent(new FormBuilder(), document);
  component.mode = mode;
  component.pending = pending;
  component.carteraCheques = cheques;
  Object.assign(component, extra);
  const emitted: GroupedPaymentSubmit[] = [];
  component.submitted.subscribe(value => emitted.push(value));
  return { component, emitted };
}

describe('GroupedPaymentModalComponent · proveedor', () => {
  it('un medio nuevo arranca con lo que falta para cancelar lo pendiente', () => {
    const { component } = setup('supplier');

    component.addLine(CASH);

    expect(component.lines.at(0).controls.amount.value).toBe(1305000);
  });

  it('el cheque de cartera se entrega entero: su monto no se edita', () => {
    const { component } = setup('supplier');
    component.addLine(SUPPLIER_CHECK);
    const line = component.lines.at(0);

    expect(line.controls.amount.disabled).toBeTrue();
    component.onChequeChange(line, 'ch-1');

    expect(line.controls.amount.value).toBe(400000);
    expect(component.total).toBe(400000);
  });

  it('un cheque ya elegido en otra línea no se ofrece de nuevo', () => {
    const { component } = setup('supplier');
    component.addLine(SUPPLIER_CHECK);
    component.addLine(SUPPLIER_CHECK);
    component.onChequeChange(component.lines.at(0), 'ch-1');

    expect(component.chequeOptionsFor(component.lines.at(1)).map(o => o.value)).toEqual(['ch-2']);
    expect(component.chequeOptionsFor(component.lines.at(0)).map(o => o.value)).toEqual(['ch-1', 'ch-2']);
  });

  it('suma los medios e imputa de la factura más vieja a la más nueva', () => {
    const { component } = setup('supplier');
    component.addLine(SUPPLIER_CHECK);
    component.onChequeChange(component.lines.at(0), 'ch-1');
    component.addLine(CASH);
    component.lines.at(1).controls.amount.setValue(100000);

    expect(component.total).toBe(500000);
    expect(component.difference).toBe(-805000);
    expect(component.fifoPreview).toEqual([
      { code: 'COMP-0118', date: '2026-09-25T00:00:00', amount: 325000, settles: true },
      { code: 'COMP-0125', date: '2026-10-14T00:00:00', amount: 175000, settles: false }
    ]);
  });

  it('lo que supera lo pendiente queda como saldo a favor', () => {
    const { component } = setup('supplier');
    component.addLine(CASH);
    component.lines.at(0).controls.amount.setValue(1400000);

    expect(component.creditLeft).toBe(95000);
  });

  it('el objetivo es lo seleccionado en Pendientes cuando viene', () => {
    const { component } = setup('supplier', { targetAmount: 325000 });
    component.addLine(TRANSFER);

    expect(component.lines.at(0).controls.amount.value).toBe(325000);
    expect(component.difference).toBe(0);
  });

  // Lección del 08/08: un formulario de plata no se manda con datos que todavía no llegaron.
  it('no deja confirmar mientras cargan los cheques, ni sin medios', () => {
    const { component } = setup('supplier', { optionsLoading: true });
    expect(component.canSubmit).toBeFalse();

    component.optionsLoading = false;
    expect(component.canSubmit).toBeFalse();
    expect(component.blockedReason).toBe('Agregá al menos un medio.');

    component.addLine(CASH);
    expect(component.canSubmit).toBeTrue();
  });

  it('dice qué medio falta completar cuando Confirmar queda deshabilitado', () => {
    const { component } = setup('supplier', { targetAmount: 1000 });
    component.addLine(CASH);
    component.addLine(CASH); // ya no falta nada: arranca en cero

    expect(component.canSubmit).toBeFalse();
    expect(component.blockedReason).toBe('Medio 2: El importe tiene que ser mayor a cero.');

    component.removeLine(1);
    expect(component.blockedReason).toBeNull();
  });

  it('un cheque de cartera sin elegir invalida el pago', () => {
    const { component } = setup('supplier');
    component.addLine(SUPPLIER_CHECK);

    expect(component.canSubmit).toBeFalse();
    component.onChequeChange(component.lines.at(0), 'ch-2');
    expect(component.canSubmit).toBeTrue();
  });

  it('confirma con un medio por línea y la referencia de la transferencia', () => {
    const { component, emitted } = setup('supplier');
    component.form.controls.date.setValue('2026-10-23');
    component.form.controls.notes.setValue('  Pago septiembre  ');
    component.addLine(SUPPLIER_CHECK);
    component.onChequeChange(component.lines.at(0), 'ch-1');
    component.addLine(TRANSFER);
    component.lines.at(1).patchValue({ amount: 905000, reference: ' Ref. 99120 ' });

    component.submit();

    expect(emitted.length).toBe(1);
    expect(emitted[0].date).toBe('2026-10-23');
    expect(emitted[0].notes).toBe('Pago septiembre');
    expect(emitted[0].lines).toEqual([
      { method: SUPPLIER_CHECK, amount: 400000, reference: null, chequeId: 'ch-1', cardBankId: null, cardCuotas: null, transferBankId: null, cheque: null },
      { method: TRANSFER, amount: 905000, reference: 'Ref. 99120', chequeId: null, cardBankId: null, cardCuotas: null, transferBankId: null, cheque: null }
    ]);
  });

  it('cambiar el medio de una línea limpia el cheque elegido', () => {
    const { component } = setup('supplier');
    component.addLine(SUPPLIER_CHECK);
    const line = component.lines.at(0);
    component.onChequeChange(line, 'ch-1');

    component.onMethodChange(line, CASH);

    expect(line.controls.chequeId.value).toBeNull();
    expect(line.controls.amount.enabled).toBeTrue();
  });
});

describe('GroupedPaymentModalComponent · cliente', () => {
  const transferBanks = [bank(3, 'Mercadopago', { useForTransfer: true }), bank(5, 'Solo tarjetas', { useForCard: true }), bank(6, 'Inactivo', { useForTransfer: true, active: false })];
  const cardBank = bank(7, 'Galicia', { useForCard: true, plans: [{ id: 1, cuotas: 3, surchargePct: 10, active: true }] });

  it('ofrece solo los bancos activos habilitados para transferencia', () => {
    const { component } = setup('customer', { banks: transferBanks });
    expect(component.transferBankOptions.map(o => o.value)).toEqual([3]);
  });

  it('exige el banco receptor cuando la empresa tiene bancos de transferencia', () => {
    const { component } = setup('customer', { banks: transferBanks });
    component.addLine(TRANSFER);
    expect(component.canSubmit).toBeFalse();

    component.lines.at(0).controls.transferBankId.setValue(3);
    expect(component.canSubmit).toBeTrue();
  });

  it('no bloquea la transferencia si la empresa no tiene bancos de transferencia cargados', () => {
    const { component } = setup('customer', { banks: [] });
    component.addLine(TRANSFER);
    expect(component.canSubmit).toBeTrue();
  });

  it('manda el banco receptor solo en las transferencias', () => {
    const { component, emitted } = setup('customer', { banks: transferBanks });
    component.addLine(TRANSFER);
    component.lines.at(0).controls.transferBankId.setValue(3);
    component.lines.at(0).controls.amount.setValue(1000);
    component.addLine(CASH);
    component.lines.at(1).controls.amount.setValue(500);

    component.submit();

    expect(emitted[0].lines.map(l => l.transferBankId)).toEqual([3, null]);
  });

  it('con un solo banco de tarjeta lo elige solo, junto con su único plan, y calcula el recargo', () => {
    const { component } = setup('customer', { banks: [cardBank] });
    component.addLine(CUSTOMER_CARD);
    const line = component.lines.at(0);
    line.controls.amount.setValue(200000);

    expect(line.controls.cardBankId.value).toBe(7);
    expect(line.controls.cardCuotas.value).toBe(3);
    expect(component.cardSurcharge(line)).toBe(20000);
    expect(component.total).toBe(200000);
  });

  it('el cheque recibido pide sus datos y viaja con el monto de la línea', () => {
    const { component, emitted } = setup('customer', { banks: [bank(1, 'Nación', { useForCheque: true })] });
    component.addLine(CUSTOMER_CHECK);
    const line = component.lines.at(0);
    line.controls.amount.setValue(100000);
    expect(component.canSubmit).toBeFalse();

    line.controls.cheque.patchValue({
      bankId: 1, numero: ' 00045120 ', titular: 'Ferretería Sur', cuitDni: '30712345678',
      fechaEmision: '2026-10-01', fechaVencimiento: '2026-11-10'
    });
    expect(component.canSubmit).toBeTrue();

    component.submit();
    expect(emitted[0].lines[0].cheque).toEqual({
      bankId: 1, numero: '00045120', titular: 'Ferretería Sur', cuitDni: '30712345678', monto: 100000,
      fechaEmision: '2026-10-01', fechaVencimiento: '2026-11-10', notas: null
    });
  });
});
