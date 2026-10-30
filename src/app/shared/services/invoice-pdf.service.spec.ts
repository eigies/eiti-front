import { jsPDF } from 'jspdf';
import { InvoicePdfService } from './invoice-pdf.service';
import { PdfBrandingService } from './pdf-branding.service';
import { PdfLayoutService } from './pdf-layout.service';

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
