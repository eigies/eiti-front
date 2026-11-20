/** Textos de presentación de la Venta guiada. La facade sigue dando sus etiquetas de siempre. */

const STEP_TITLES: Record<string, string> = {
  Cliente: 'Cliente',
  Datos: 'Datos',
  Domicilio: 'Domicilio',
  Venta: 'Venta',
  Envio: 'Envío',
  Confirmacion: 'Confirmación'
};

/** Etiqueta del paso con sus tildes ("Envio" → "Envío"). */
export function guidedStepTitle(label: string): string {
  return STEP_TITLES[label] ?? label;
}

/** Texto con tildes para la modalidad de entrega. */
export function deliveryLabel(requiresDelivery: boolean): string {
  return requiresDelivery ? 'Con envío' : 'Retira el cliente';
}
