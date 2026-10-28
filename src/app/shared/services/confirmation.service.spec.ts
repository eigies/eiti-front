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

  it('passes the receivers comparison to the dialog', () => {
    void service.confirm({
      title: 'La factura salió a otro CUIT',
      message: 'La nota de crédito va al receptor de la factura.',
      comparison: {
        primary: { caption: 'Factura A 00010-00000039 · se emitió a', name: 'TRANSPORTE OLIVOS S.A -', identification: 'CUIT: 30-68225650-4', vatCondition: 'IVA Responsable Inscripto' },
        secondary: { caption: 'Ficha del cliente hoy', name: 'TRANSPORTE OLIVOS S.A -', identification: 'CUIT: 30-51743143-1', vatCondition: 'IVA Responsable Inscripto' }
      }
    });

    expect(state?.comparison?.primary.identification).toBe('CUIT: 30-68225650-4');
    expect(state?.detail).toBeNull();
    service.cancel();
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
