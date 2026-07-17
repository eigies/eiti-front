import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfBrandingService } from './pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from './pdf-layout.service';
import { QuoteDetailResponse } from '../../core/models/quote.models';

// Mismo generador que remito-pdf.service.ts (logo/marca de agua/pie de EITI) para que el
// presupuesto se vea igual que el resto de los documentos del sistema.
@Injectable({ providedIn: 'root' })
export class QuotePdfService {
  constructor(
    private readonly brandingService: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {}

  async generate(quote: QuoteDetailResponse): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;
    const hasDiscount = quote.generalDiscountPercent > 0 || quote.details.some(detail => detail.discountPercent > 0);

    const itemColumns: PdfTableColumn[] = hasDiscount
      ? [
        { header: '#', width: 12 },
        { header: 'Producto', width: 76 },
        { header: 'Cant.', width: 16, align: 'right' },
        { header: 'Unitario', width: 30, align: 'right' },
        { header: 'Desc.', width: 16, align: 'right' },
        { header: 'Subtotal', width: 32, align: 'right' }
      ]
      : [
        { header: '#', width: 12 },
        { header: 'Producto', width: 92 },
        { header: 'Cant.', width: 18, align: 'right' },
        { header: 'Unitario', width: 34, align: 'right' },
        { header: 'Subtotal', width: 36, align: 'right' }
      ];
    const itemTableColumns = this.pdfLayout.resolveColumns(margin, itemColumns);
    const [numberCol, productCol, quantityCol] = itemTableColumns;

    const formatCurrency = (value: number): string =>
      `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (value: string): string =>
      new Date(value).toLocaleDateString('es-AR');

    const docTitle = 'Presupuesto';
    const nro = quote.code || quote.id;

    let y = margin;

    const drawDocumentHeader = (continuation = false): void => {
      this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.brandingService.drawHeader(doc, branding, {
        title: continuation ? `${docTitle} / Continuacion` : docTitle,
        subtitle: `Nro. ${nro} · Fecha: ${formatDate(quote.createdAt)}`,
        margin,
        y,
        pageWidth
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
    };

    const drawMetaBlock = (): void => {
      const rowsLeft: [string, string][] = [
        ['Sucursal', quote.branchName],
        ['Cliente', quote.customerFullName ?? quote.prospectName ?? '-']
      ];
      if (quote.prospectContact) {
        rowsLeft.push(['Contacto', quote.prospectContact]);
      }
      const rowsRight: [string, string][] = [
        ['Estado', quote.status],
        ['Valido hasta', formatDate(quote.expiresAt)],
        ['Items', `${quote.details.length}`]
      ];

      const rowCount = Math.max(rowsLeft.length, rowsRight.length);
      const rowHeight = 6.5;
      const metaTop = y;
      const metaHeight = rowCount * rowHeight + 6;
      const halfWidth = contentWidth / 2;
      const leftX = margin + 3;
      const rightX = margin + halfWidth + 3;
      const valueOffset = 22;

      doc.setDrawColor(185, 185, 185);
      doc.rect(margin, metaTop, contentWidth, metaHeight);
      doc.line(margin + halfWidth, metaTop, margin + halfWidth, metaTop + metaHeight);

      doc.setFontSize(9);
      for (let index = 0; index < rowCount; index += 1) {
        const rowY = metaTop + 6 + index * rowHeight;
        if (rowsLeft[index]) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(70, 70, 70);
          doc.text(`${rowsLeft[index][0]}:`, leftX, rowY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(25, 25, 25);
          doc.text(rowsLeft[index][1], leftX + valueOffset, rowY, { maxWidth: halfWidth - valueOffset - 6 });
        }
        if (rowsRight[index]) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(70, 70, 70);
          doc.text(`${rowsRight[index][0]}:`, rightX, rowY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(25, 25, 25);
          doc.text(rowsRight[index][1], rightX + valueOffset, rowY, { maxWidth: halfWidth - valueOffset - 6 });
        }
      }

      y = metaTop + metaHeight + 6;
    };

    const drawItemsHeader = (continuation: boolean): void => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(25, 25, 25);
      doc.text(continuation ? 'Detalle de productos (continuacion)' : 'Detalle de productos', margin, y);
      y += 5;

      y = this.pdfLayout.drawTableHeader(doc, itemTableColumns, y, {
        tableWidth: contentWidth,
        height: 8,
        fontSize: 8.6
      });
    };

    const startDetailsPage = (continuation: boolean): void => {
      if (continuation) {
        doc.addPage();
        y = margin;
        drawDocumentHeader(true);
      }
      drawItemsHeader(continuation);
    };

    drawDocumentHeader();
    drawMetaBlock();
    startDetailsPage(false);

    const drawItemRow = (rowValues: string[]): void => {
      const rowHeight = this.pdfLayout.measureTableRowHeight(doc, itemTableColumns, rowValues, {
        tableWidth: contentWidth,
        wrap: true,
        minHeight: 8,
        lineHeight: 3.8,
        fontSize: 8.5
      });

      if (y + rowHeight > printableBottom) {
        startDetailsPage(true);
      }

      doc.setDrawColor(205, 205, 205);
      for (const column of itemTableColumns) {
        doc.rect(column.x, y, column.width, rowHeight);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(25, 25, 25);
      doc.text(rowValues[0], numberCol.x + 2, y + rowHeight / 2 + 1.2);
      doc.text(this.pdfLayout.splitCellText(doc, rowValues[1], productCol), productCol.x + 2, y + 4.6);
      doc.text(rowValues[2], quantityCol.x + quantityCol.width - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
      for (let colIndex = 3; colIndex < itemTableColumns.length; colIndex += 1) {
        const col = itemTableColumns[colIndex];
        doc.text(rowValues[colIndex] ?? '', col.x + col.width - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
      }

      y += rowHeight;
    };

    quote.details.forEach((detail, index) => {
      const row = [
        `${index + 1}`,
        `${detail.productBrand} / ${detail.productName}`,
        `${detail.quantity}`,
        formatCurrency(detail.unitPrice)
      ];
      if (hasDiscount) {
        row.push(detail.discountPercent > 0 ? `${detail.discountPercent}%` : '-');
      }
      row.push(formatCurrency(detail.lineTotal));
      drawItemRow(row);
    });

    if (y + 24 > printableBottom) {
      doc.addPage();
      y = margin;
      drawDocumentHeader(true);
    }
    const subtotal = quote.details.reduce((sum, detail) => sum + detail.lineTotal, 0);
    const summaryWidth = 72;
    const summaryX = pageWidth - margin - summaryWidth;
    const summaryHeight = quote.generalDiscountPercent > 0 ? 28 : 16;
    doc.setFillColor(246, 246, 246);
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(summaryX, y + 5, summaryWidth, summaryHeight, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 45, 45);
    doc.setFontSize(9.5);
    doc.text(quote.generalDiscountPercent > 0 ? 'SUBTOTAL' : 'TOTAL', summaryX + 3, y + 11);
    doc.setFontSize(quote.generalDiscountPercent > 0 ? 10.5 : 12.5);
    doc.text(
      formatCurrency(subtotal),
      summaryX + summaryWidth - 3,
      quote.generalDiscountPercent > 0 ? y + 11 : y + 17,
      { align: 'right' }
    );
    if (quote.generalDiscountPercent > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Descuento (${quote.generalDiscountPercent}%)`, summaryX + 3, y + 18);
      doc.text(`-${formatCurrency(subtotal - quote.totalAmount)}`, summaryX + summaryWidth - 3, y + 18, { align: 'right' });
      doc.setDrawColor(180, 180, 180);
      doc.line(summaryX + 3, y + 21, summaryX + summaryWidth - 3, y + 21);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', summaryX + 3, y + 27);
      doc.setFontSize(11.5);
      doc.text(formatCurrency(quote.totalAmount), summaryX + summaryWidth - 3, y + 27, { align: 'right' });
    }

    // Fecha de vencimiento destacada, para que quede claro que no es una venta concretada.
    y += summaryHeight + 12;
    if (y > printableBottom) {
      doc.addPage();
      y = margin;
      drawDocumentHeader(true);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(180, 40, 40);
    doc.text(`Valido hasta: ${formatDate(quote.expiresAt)}`, margin, y);

    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, 'Presupuesto - no constituye una venta');

    doc.save(`presupuesto-${quote.code ?? quote.id}.pdf`);
  }
}
