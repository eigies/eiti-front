/** Formato de la patente: nueva (AB 123 CD), vieja (ABC 123) u otra. */
export type PlateStyle = 'mercosur' | 'old' | 'other';

export function plateStyle(plate: string): PlateStyle {
  const clean = (plate || '').toUpperCase().replace(/[\s-]/g, '');
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean)) return 'mercosur';
  if (/^[A-Z]{3}\d{3}$/.test(clean)) return 'old';
  return 'other';
}

export function formatPlate(plate: string): string {
  const clean = (plate || '').toUpperCase().replace(/[\s-]/g, '');
  const style = plateStyle(clean);
  if (style === 'mercosur') return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  if (style === 'old') return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  return (plate || '').toUpperCase();
}

/** Color de cada tipo de registro: combustible ámbar, mantenimiento índigo, inspección celeste, incidente rojo, nota gris. */
export function logKind(typeName: string): string {
  switch (typeName) {
    case 'FuelLoad': return 'sale';
    case 'Maintenance': return 'transfer-out';
    case 'Inspection': return 'transfer-in';
    case 'Incident': return 'out';
    default: return 'neutral';
  }
}
