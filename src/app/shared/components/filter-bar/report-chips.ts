import { FormGroup } from '@angular/forms';
import { SearchableSelectOption } from '../searchable-select/searchable-select.component';
import { ReportChip } from './report-filters.component';

/** Un filtro opcional del reporte: su control, su nombre, sus opciones y el valor que significa "todos". */
export interface ReportChipDef {
  key: string;
  label: string;
  options?: SearchableSelectOption[];
  empty?: unknown;
}

/** Etiquetas de los filtros activos ("Canal: Mostrador") a partir del valor del formulario. */
export function reportChips(form: FormGroup, defs: ReportChipDef[]): ReportChip[] {
  const value = form.getRawValue() as Record<string, unknown>;
  const chips: ReportChip[] = [];
  for (const def of defs) {
    const current = value[def.key];
    const empty = def.empty === undefined ? null : def.empty;
    if (current === null || current === undefined || current === '' || current === empty) continue;
    const option = def.options?.find(item => String(item.value) === String(current));
    chips.push({ key: def.key, label: `${def.label}: ${option?.label ?? String(current)}` });
  }
  return chips;
}

/** Vuelve un filtro a su valor de "todos". */
export function clearReportFilter(form: FormGroup, defs: ReportChipDef[], key: string): void {
  const def = defs.find(item => item.key === key);
  form.get(key)?.setValue(def?.empty === undefined ? null : def.empty);
}
