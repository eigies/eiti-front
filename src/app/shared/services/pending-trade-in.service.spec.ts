import { ConfirmationService } from './confirmation.service';
import { PendingTradeInService } from './pending-trade-in.service';

describe('PendingTradeInService', () => {
  let confirmation: jasmine.SpyObj<ConfirmationService>;
  let service: PendingTradeInService;

  beforeEach(() => {
    confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    service = new PendingTradeInService(confirmation);
  });

  // Sin canje pendiente el guardado tiene que seguir de largo, sin modal de por medio.
  it('no abre nada cuando no hay canjes pendientes', async () => {
    await expectAsync(service.confirmDiscard([])).toBeResolvedTo(true);
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  it('devuelve lo que eligio el usuario', async () => {
    confirmation.confirm.and.resolveTo(false);
    await expectAsync(service.confirmDiscard(['MOURA · 1 u · $85.000'])).toBeResolvedTo(false);

    confirmation.confirm.and.resolveTo(true);
    await expectAsync(service.confirmDiscard(['MOURA · 1 u · $85.000'])).toBeResolvedTo(true);
  });

  it('lista cada canje pendiente en el detalle', async () => {
    confirmation.confirm.and.resolveTo(true);

    await service.confirmDiscard(['MOURA · 1 u · $85.000', 'VARTA · 2 u · $40.000']);

    const options = confirmation.confirm.calls.mostRecent().args[0];
    expect(options.detail).toContain('MOURA');
    expect(options.detail).toContain('VARTA');
    expect(options.tone).toBe('danger');
    // El default del modal es volver al formulario, no seguir de largo.
    expect(options.cancelLabel).toBe('Volver');
    expect(options.confirmLabel).toContain('Continuar sin los canjes');
  });

  it('usa singular con un solo canje', async () => {
    confirmation.confirm.and.resolveTo(true);

    await service.confirmDiscard(['MOURA · 1 u · $85.000']);

    const options = confirmation.confirm.calls.mostRecent().args[0];
    expect(options.title).toContain('un canje');
    expect(options.confirmLabel).toBe('Continuar sin el canje');
  });
});
