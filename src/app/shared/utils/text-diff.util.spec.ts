import { diffSegments } from './text-diff.util';

describe('diffSegments', () => {
  it('marca los digitos de un CUIT que no coinciden con el otro', () => {
    expect(diffSegments('CUIT: 30-68225650-4', 'CUIT: 30-51743143-1')).toEqual([
      { text: 'CUIT: 30-', differs: false },
      { text: '68225650', differs: true },
      { text: '-', differs: false },
      { text: '4', differs: true }
    ]);
  });

  it('dos documentos iguales no tienen nada resaltado', () => {
    expect(diffSegments('CUIT: 30-68225650-4', 'CUIT: 30-68225650-4')).toEqual([
      { text: 'CUIT: 30-68225650-4', differs: false }
    ]);
  });

  it('con largos distintos el documento entero cuenta como distinto', () => {
    expect(diffSegments('DNI: 30111222', 'CUIT: 30-68225650-4')).toEqual([{ text: 'DNI: 30111222', differs: true }]);
  });

  it('sin el otro documento no se resalta nada', () => {
    expect(diffSegments('CUIT: 30-68225650-4', null)).toEqual([{ text: 'CUIT: 30-68225650-4', differs: false }]);
  });
});
