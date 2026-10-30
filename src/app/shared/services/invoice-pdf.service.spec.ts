import { jsPDF } from 'jspdf';
import { InvoicePdfService } from './invoice-pdf.service';
import { PdfBrandingService } from './pdf-branding.service';
import { PdfLayoutService } from './pdf-layout.service';
import { SaleInvoicePrintAdjustments, SaleInvoicePrintResponse } from '../../core/models/sale.models';

describe('InvoicePdfService · observaciones', () => {
  type DrawNotes = (doc: jsPDF, notes: string | null | undefined, margin: number, contentWidth: number, y: number,
    ensureSpace: (height: number, withTableHeader: boolean) => void) => number;

  function setup() {
    const service = new InvoicePdfService({} as PdfBrandingService, {} as PdfLayoutService);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const text = spyOn(doc, 'text').and.callThrough();
    const drawNotes = (service as unknown as { drawNotes: DrawNotes }).drawNotes.bind(service);
    return { doc, text, drawNotes };
  }

  it('dibuja el bloque con la nota de la venta', () => {
    const { doc, text, drawNotes } = setup();

    const y = drawNotes(doc, 'Presupuesto PRE-0012 - Patente AB123CD', 14, 182, 100, () => undefined);

    const written = text.calls.allArgs().map(args => args[0]).flat();
    expect(written).toContain('Observaciones');
    expect(written.join(' ')).toContain('Presupuesto PRE-0012 - Patente AB123CD');
    expect(y).toBeGreaterThan(100);
  });

  it('sin nota no dibuja nada ni corre el renglón', () => {
    const { doc, text, drawNotes } = setup();

    expect(drawNotes(doc, null, 14, 182, 100, () => undefined)).toBe(100);
    expect(drawNotes(doc, '   ', 14, 182, 100, () => undefined)).toBe(100);
    expect(text).not.toHaveBeenCalled();
  });
});

// El recargo de la tarjeta en cuotas entra en el total facturado: va con su renglón entre los ajustes,
// y solo si el comprobante autorizado lo incluye (el back manda 0 si no).
describe('InvoicePdfService · recargo de tarjeta', () => {
  type DrawAdjustments = (doc: jsPDF, print: SaleInvoicePrintResponse, toShown: (withVat: number) => number,
    margin: number, contentWidth: number, y: number, ensureSpace: (height: number, withTableHeader: boolean) => void) => number;

  function setup() {
    const service = new InvoicePdfService({} as PdfBrandingService, {} as PdfLayoutService);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const text = spyOn(doc, 'text').and.callThrough();
    const drawAdjustments = (service as unknown as { drawAdjustments: DrawAdjustments }).drawAdjustments.bind(service);
    return { doc, text, drawAdjustments };
  }

  function printWith(adjustments: SaleInvoicePrintAdjustments): SaleInvoicePrintResponse {
    return { adjustments } as SaleInvoicePrintResponse;
  }

  it('dibuja el renglón del recargo con su texto y su monto', () => {
    const { doc, text, drawAdjustments } = setup();
    const print = printWith({
      itemsSubtotal: 4000, noDeliverySurcharge: 0, generalDiscountPercent: 0, agreedPrice: null,
      cardSurcharge: 450, cardSurchargeLabel: 'Recargo financiero tarjeta (Santander, 3 cuotas, 15%)'
    });

    const y = drawAdjustments(doc, print, value => value, 14, 182, 100, () => undefined);

    const written = text.calls.allArgs().map(args => args[0]);
    expect(written).toContain('Recargo financiero tarjeta (Santander, 3 cuotas, 15%)');
    expect(written).toContain('$ 450,00');
    expect(y).toBeGreaterThan(100);
  });

  it('sin recargo no agrega renglón', () => {
    const { doc, text, drawAdjustments } = setup();
    const print = printWith({ itemsSubtotal: 4000, noDeliverySurcharge: 0, generalDiscountPercent: 0, agreedPrice: null, cardSurcharge: 0, cardSurchargeLabel: null });

    expect(drawAdjustments(doc, print, value => value, 14, 182, 100, () => undefined)).toBe(100);
    expect(text).not.toHaveBeenCalled();
  });
});
