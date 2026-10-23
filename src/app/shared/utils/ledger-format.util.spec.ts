import { LedgerMeans, LedgerRow, SUPPLIER_LEDGER_LABELS } from '../../core/models/account-ledger.models';
import { formatLedgerDate, meansDetail, meansSummary, rowDetail, rowTitle } from './ledger-format.util';

function means(partial: Partial<LedgerMeans>): LedgerMeans {
  return {
    paymentId: 'p', method: 'cash', methodLabel: 'Efectivo', amount: 1, reference: null, chequeNumber: null,
    bankName: null, dueDate: null, cardInstallments: null, cardSurcharge: null, ...partial
  };
}

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    kind: 'payment', source: 'payment_order', id: 'op-1', date: '2026-10-02T00:00:00', code: 'OP-0004',
    document: null, description: 'Orden de pago', debit: 0, credit: 1, balance: 0, isCancelled: false,
    means: [], imputations: [], ...partial
  };
}

describe('ledger-format', () => {
  // Un "2026-10-02" parseado con Date es UTC: en Argentina mostraría el 1/10.
  it('formatea la fecha de negocio sin pasar por Date', () => {
    expect(formatLedgerDate('2026-10-02T00:00:00')).toBe('02/10/2026');
    expect(formatLedgerDate('2026-10-02')).toBe('02/10/2026');
    expect(formatLedgerDate(null)).toBe('');
  });

  it('resume los medios de un pago agrupado', () => {
    expect(meansSummary([
      means({ method: 'check', methodLabel: 'Cheque' }),
      means({ method: 'check', methodLabel: 'Cheque' }),
      means({ method: 'check', methodLabel: 'Cheque' }),
      means({ method: 'transfer', methodLabel: 'Transferencia' }),
      means({ method: 'cash' })
    ])).toBe('5 medios · 3 cheques + transf. + efectivo');
    expect(meansSummary([means({ method: 'transfer', methodLabel: 'Transferencia' })])).toBe('Transferencia');
  });

  it('detalla cheques y tarjetas', () => {
    expect(meansDetail(means({ method: 'check', chequeNumber: '00012345', bankName: 'Nación', dueDate: '2026-10-20T00:00:00' })))
      .toBe('Nº 00012345 · Nación · vto 20/10');
    expect(meansDetail(means({ method: 'card', bankName: 'Galicia', cardInstallments: 3, cardSurcharge: 20000 })))
      .toBe('Galicia · 3 cuotas (+$20.000,00)');
    expect(meansDetail(means({ method: 'transfer', reference: 'Ref. 88213' }))).toBe('Ref. 88213');
    expect(meansDetail(means({ method: 'transfer', bankName: 'Mercadopago', reference: 'Ref. 88213' })))
      .toBe('Mercadopago · Ref. 88213');
    expect(meansDetail(means({}))).toBe('—');
  });

  it('un pago sin número se muestra como Pago y la nota del usuario acompaña al resumen', () => {
    expect(rowTitle(row({ code: null, source: 'payment' }), SUPPLIER_LEDGER_LABELS)).toBe('Pago');
    expect(rowDetail(row({ means: [means({}), means({})], description: 'Pago septiembre' })))
      .toBe('2 medios · efectivo · Pago septiembre');
    expect(rowDetail(row({ means: [means({}), means({})] }))).toBe('2 medios · efectivo');
  });

  it('el canje de una venta CC se muestra como Canje, con su descripción', () => {
    const canje = row({
      source: 'trade_in', code: null, description: 'Canje en la venta MAT-1626',
      means: [means({ method: 'trade_in', methodLabel: 'Canje', amount: 140000 })]
    });
    expect(rowTitle(canje, SUPPLIER_LEDGER_LABELS)).toBe('Canje');
    expect(rowDetail(canje)).toBe('Canje en la venta MAT-1626');
  });
});
