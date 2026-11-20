import { PermissionCatalog } from '../../../core/models/permission.models';

const LABELS = new Map<string, string>(PermissionCatalog.map(entry => [entry.code, entry.label]));

/** Nombre legible de un permiso ("Ventas · crear"); si no está en el catálogo, el código tal cual. */
export function permissionDisplayName(code: string): string {
  const label = LABELS.get(code);
  return label ? label.replace(/\s*:\s*/, ' · ') : code;
}
