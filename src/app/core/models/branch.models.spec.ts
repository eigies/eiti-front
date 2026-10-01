import { formatPointOfSale } from '../models/branch.models';

describe('formatPointOfSale', () => {
  it('muestra el punto de venta con 5 digitos como en el comprobante', () => {
    expect(formatPointOfSale(3)).toBe('00003');
    expect(formatPointOfSale(12345)).toBe('12345');
  });
});
