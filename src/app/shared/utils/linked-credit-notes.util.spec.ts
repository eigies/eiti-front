import { hasActiveLinkedCreditNotes, linkedCreditNotesConfirmation } from './linked-credit-notes.util';

describe('linked-credit-notes', () => {
  it('reconoce los codigos con los que el back pide confirmar las notas de credito vinculadas', () => {
    expect(hasActiveLinkedCreditNotes({ error: { errorCode: 'Purchases.Cancel.HasActiveCreditNote' } })).toBeTrue();
    expect(hasActiveLinkedCreditNotes({ error: { errorCode: 'Sales.Cancel.HasActiveCreditNote' } })).toBeTrue();
    expect(hasActiveLinkedCreditNotes({ error: { errorCode: 'Purchases.Cancel.InsufficientCreditForCreditNotes' } })).toBeFalse();
    expect(hasActiveLinkedCreditNotes(null)).toBeFalse();
  });

  // COMP-0218 de BATERIAS MATEO: el back nombra la nota y su importe; el dialogo lo muestra tal cual.
  it('muestra que notas se anulan, con el mensaje del back', () => {
    const detail = 'La compra tiene vigente la nota de crédito NCP-002 por $ 231.890,86. Si confirmás, se anula junto con la compra.';

    const options = linkedCreditNotesConfirmation(
      { error: { errorCode: 'Purchases.Cancel.HasActiveCreditNote', detail } },
      'Cancelar la compra y sus notas de crédito');

    expect(options.message).toBe(detail);
    expect(options.tone).toBe('danger');
    expect(options.confirmLabel).toBe('Cancelar la compra y sus notas de crédito');
  });
});
