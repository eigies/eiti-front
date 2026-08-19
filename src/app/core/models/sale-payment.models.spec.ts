import {
  SalePaymentDraftState,
  describeTradeInLine,
  dropPendingTradeInLines,
  normalizeSaleTradeIns,
  pendingTradeInLines
} from './sale-payment.models';

function stateWith(tradeIns: SalePaymentDraftState['tradeIns']): SalePaymentDraftState {
  return { hasCombinedPayment: false, hasTradeIn: tradeIns.length > 0, payments: [], tradeIns };
}

describe('pendingTradeInLines', () => {
  it('no marca una linea recien agregada y vacia', () => {
    const state = stateWith([{ productId: '', quantity: 1, amount: 0 }]);
    expect(pendingTradeInLines(state)).toEqual([]);
  });

  it('marca una linea con producto pero sin monto', () => {
    const state = stateWith([{ productId: 'p1', quantity: 1, amount: 0 }]);
    expect(pendingTradeInLines(state).length).toBe(1);
  });

  it('marca una linea con monto pero sin producto', () => {
    const state = stateWith([{ productId: '', quantity: 1, amount: 85000 }]);
    expect(pendingTradeInLines(state).length).toBe(1);
  });

  it('marca una linea con cantidad cero', () => {
    const state = stateWith([{ productId: 'p1', quantity: 0, amount: 85000 }]);
    expect(pendingTradeInLines(state).length).toBe(1);
  });

  it('no marca una linea completa', () => {
    const state = stateWith([{ productId: 'p1', quantity: 2, amount: 85000 }]);
    expect(pendingTradeInLines(state)).toEqual([]);
  });

  // La razon de ser de la funcion: lo pendiente es exactamente lo que no viaja con la venta.
  it('lo pendiente es lo que normalizeSaleTradeIns descarta', () => {
    const state = stateWith([
      { productId: 'p1', quantity: 2, amount: 85000 },
      { productId: '', quantity: 1, amount: 40000 }
    ]);

    expect(normalizeSaleTradeIns(state).length).toBe(1);
    expect(pendingTradeInLines(state).length).toBe(1);
  });
});

describe('dropPendingTradeInLines', () => {
  it('deja solo las lineas completas y apaga el flag si no queda ninguna', () => {
    const state = stateWith([{ productId: '', quantity: 1, amount: 40000 }]);

    dropPendingTradeInLines(state);

    expect(state.tradeIns).toEqual([]);
    expect(state.hasTradeIn).toBeFalse();
  });

  it('conserva las completas', () => {
    const state = stateWith([
      { productId: 'p1', quantity: 2, amount: 85000 },
      { productId: '', quantity: 1, amount: 40000 }
    ]);

    dropPendingTradeInLines(state);

    expect(state.tradeIns.length).toBe(1);
    expect(state.tradeIns[0].productId).toBe('p1');
    expect(state.hasTradeIn).toBeTrue();
  });
});

describe('describeTradeInLine', () => {
  const products = [{ id: 'p1', brand: 'MOURA', name: '12x65 20GD' }];

  it('arma marca, unidades y valor', () => {
    const text = describeTradeInLine({ productId: 'p1', quantity: 2, amount: 85000 }, products);
    expect(text).toContain('MOURA 12x65 20GD');
    expect(text).toContain('2 u');
    expect(text).toContain('85.000');
  });

  // Lo que falta tiene que verse: es la razon por la que el canje no se agrego.
  it('nombra lo que falta en vez de dejarlo vacio', () => {
    expect(describeTradeInLine({ productId: '', quantity: 1, amount: 85000 }, products))
      .toContain('Producto sin elegir');
    expect(describeTradeInLine({ productId: 'p1', quantity: 1, amount: 0 }, products))
      .toContain('sin valor');
  });
});
