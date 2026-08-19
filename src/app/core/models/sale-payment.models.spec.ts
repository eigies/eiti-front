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

  // Un canje en cero es valido: el dominio solo rechaza negativos y el validador del backend
  // pide GreaterThanOrEqualTo(0). Marcarlo como pendiente hacia imposible guardarlo, porque
  // el unico camino que dejaba avanzar era descartar la linea.
  it('no marca una linea completa con monto cero', () => {
    const state = stateWith([{ productId: 'p1', quantity: 1, amount: 0 }]);

    expect(normalizeSaleTradeIns(state).length).toBe(1);
    expect(pendingTradeInLines(state)).toEqual([]);
  });

  it('marca una linea con monto negativo', () => {
    const state = stateWith([{ productId: 'p1', quantity: 1, amount: -500 }]);

    expect(normalizeSaleTradeIns(state)).toEqual([]);
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

  // La razon de ser de la funcion: lo pendiente es EXACTAMENTE lo que no viaja con la venta.
  // La version anterior de este test usaba una sola linea sin producto, que las dos funciones
  // descartan igual, asi que nunca toco el caso donde discrepaban (monto cero) y dejo pasar
  // el bug. Ahora se recorre cada forma y se comparan las dos definiciones una por una.
  it('lo pendiente es exactamente lo que normalizeSaleTradeIns descarta', () => {
    const shapes = [
      { productId: 'p1', quantity: 2, amount: 85000 },
      { productId: 'p1', quantity: 1, amount: 0 },
      { productId: 'p1', quantity: 0, amount: 85000 },
      { productId: 'p1', quantity: 1, amount: -500 },
      { productId: '', quantity: 1, amount: 40000 },
      { productId: '', quantity: 3, amount: 0 }
    ];

    for (const shape of shapes) {
      const state = stateWith([shape]);
      const viaja = normalizeSaleTradeIns(state).length === 1;
      const pendiente = pendingTradeInLines(state).length === 1;

      expect(pendiente)
        .withContext(`${JSON.stringify(shape)} viaja=${viaja} pendiente=${pendiente}`)
        .toBe(!viaja);
    }
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
