import { Injectable } from '@angular/core';
import { ConfirmationService } from './confirmation.service';

/**
 * Aviso unico para "cargaste un canje y no lo agregaste".
 *
 * El canje se pierde en silencio en tres pantallas distintas y cada una lo detecta a su
 * manera (formulario de armado en cuenta corriente, linea incompleta en el componente
 * compartido de pagos). Lo que NO puede variar es el aviso, asi que vive aca y las
 * pantallas solo aportan como se describe cada canje pendiente.
 */
@Injectable({ providedIn: 'root' })
export class PendingTradeInService {
  constructor(private readonly confirmation: ConfirmationService) {}

  /**
   * `true` para seguir sin el canje, `false` para volver al formulario.
   * Sin canjes pendientes no abre nada y devuelve `true`.
   */
  async confirmDiscard(pending: readonly string[]): Promise<boolean> {
    if (pending.length === 0) {
      return true;
    }

    const plural = pending.length > 1;
    return this.confirmation.confirm({
      eyebrow: 'Canje sin agregar',
      title: plural
        ? 'Tenés canjes cargados que no agregaste'
        : 'Tenés un canje cargado que no agregaste',
      message: plural
        ? 'Estos canjes no van a quedar registrados en la venta.'
        : 'Este canje no va a quedar registrado en la venta.',
      detail: pending.join('\n'),
      tone: 'danger',
      confirmLabel: plural ? 'Continuar sin los canjes' : 'Continuar sin el canje',
      cancelLabel: 'Volver'
    });
  }
}
