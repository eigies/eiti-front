/** Fila normalizada que consume el selector de productos compartido. */
export interface ProductPickerRow {
  /** Id del producto (lo que se emite al confirmar). */
  readonly id: string;
  /** Línea principal: marca / nombre. */
  readonly title: string;
  /** Línea secundaria: código · SKU. */
  readonly subtitle: string;
  /** Stock disponible ya descontado el carrito. `<= 0` => no seleccionable. */
  readonly available: number;
  /** Texto en minúsculas para el filtro interno (código, sku, marca, nombre). */
  readonly search: string;
}

/** Selección emitida al confirmar. */
export interface ProductPickerSelection {
  readonly id: string;
  readonly quantity: number;
}

/** Datos mínimos de producto para armar una fila del selector. */
export interface ProductPickerSource {
  readonly id: string;
  readonly code: string;
  readonly sku?: string | null;
  readonly brand: string;
  readonly name: string;
}

/** Normaliza un producto + su stock disponible en una fila del selector. */
export function toProductPickerRow(source: ProductPickerSource, available: number): ProductPickerRow {
  const subtitle = [source.code, source.sku].filter(value => !!value).join(' · ');
  return {
    id: source.id,
    title: [source.brand, source.name].filter(value => !!value).join(' / '),
    subtitle,
    available,
    search: `${source.code} ${source.sku ?? ''} ${source.brand} ${source.name}`.toLowerCase()
  };
}
