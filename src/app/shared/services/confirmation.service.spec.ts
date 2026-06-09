import { ConfirmationDialogState, ConfirmationService } from './confirmation.service';

describe('ConfirmationService', () => {
  let service: ConfirmationService;
  let state: ConfirmationDialogState | null;

  beforeEach(() => {
    service = new ConfirmationService();
    state = null;
    service.state$.subscribe(value => state = value);
  });

  it('resolves true when the dialog is accepted', async () => {
    const result = service.confirm({
      title: 'Eliminar registro',
      message: 'Esta accion no se puede deshacer.',
      tone: 'danger'
    });

    expect(state?.title).toBe('Eliminar registro');
    expect(state?.confirmLabel).toBe('Confirmar');
    expect(state?.tone).toBe('danger');

    service.accept();

    await expectAsync(result).toBeResolvedTo(true);
    expect(state).toBeNull();
  });

  it('resolves false when the dialog is cancelled', async () => {
    const result = service.confirm({
      title: 'Descartar cambios',
      message: 'Hay cambios sin guardar.'
    });

    service.cancel();

    await expectAsync(result).toBeResolvedTo(false);
    expect(state).toBeNull();
  });

  it('rejects a second confirmation while one is already open', async () => {
    const first = service.confirm({
      title: 'Primera accion',
      message: 'Confirma la primera accion.'
    });
    const second = service.confirm({
      title: 'Segunda accion',
      message: 'No debe reemplazar el dialogo activo.'
    });

    await expectAsync(second).toBeResolvedTo(false);
    expect(state?.title).toBe('Primera accion');

    service.cancel();
    await expectAsync(first).toBeResolvedTo(false);
  });
});
