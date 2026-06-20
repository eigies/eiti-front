import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../utils/money.util';

/**
 * Pipe de formato de plata (es-AR, 2 decimales). Envuelve `formatMoney`.
 * Uso: `{{ amount | money }}` o `{{ amount | money:true }}` (con símbolo `$`).
 */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, withSymbol = false): string {
    return formatMoney(value, withSymbol);
  }
}
