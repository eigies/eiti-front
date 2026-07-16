// src/app/shared/utils/quote-pdf.util.ts
import { jsPDF } from 'jspdf';
import { QuoteDetailResponse } from '../../core/models/quote.models';

export function generateQuotePdf(quote: QuoteDetailResponse): void {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text(`Presupuesto ${quote.code ?? ''}`, 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Cliente: ${quote.customerFullName ?? quote.prospectName ?? '-'}`, 14, y);
    y += 6;
    doc.text(`Sucursal: ${quote.branchName}`, 14, y);
    y += 6;
    doc.text(`Fecha: ${new Date(quote.createdAt).toLocaleDateString('es-AR')}`, 14, y);
    y += 6;
    doc.setTextColor(200, 0, 0);
    doc.text(`Valido hasta: ${new Date(quote.expiresAt).toLocaleDateString('es-AR')}`, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setFontSize(9);
    doc.text('Producto', 14, y);
    doc.text('Cant.', 120, y);
    doc.text('Precio unit.', 145, y);
    doc.text('Total', 180, y);
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    for (const detail of quote.details) {
        doc.text(`${detail.productBrand} ${detail.productName}`.slice(0, 60), 14, y);
        doc.text(String(detail.quantity), 120, y);
        doc.text(detail.unitPrice.toFixed(2), 145, y);
        doc.text(detail.lineTotal.toFixed(2), 180, y);
        y += 6;
    }

    y += 4;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`Total: $${quote.totalAmount.toFixed(2)}`, 14, y);
    y += 12;

    doc.setFontSize(8);
    doc.text('Presupuesto - no constituye una venta.', 14, y);

    doc.save(`presupuesto-${quote.code ?? quote.id}.pdf`);
}
