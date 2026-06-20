/**
 * Formatea un importe en pesos (es-AR, 2 decimales). Fuente única de verdad para el formato
 * de plata que estaba duplicado en varios componentes como `formatCurrency`.
 * @param withSymbol prefija el símbolo `$` (algunos contextos lo agregan en el template).
 */
export function formatMoney(value: number | null | undefined, withSymbol = false): string {
  const formatted = (value ?? 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return withSymbol ? `$${formatted}` : formatted;
}
