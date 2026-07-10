import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfBrandingService } from './pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from './pdf-layout.service';

export interface StockTransferPdfItem {
  code: string;
  name: string;
  quantity: number;
}

export interface StockTransferPdfContext {
  sourceBranchName: string;
  destinationBranchName: string;
  description?: string | null;
  items: StockTransferPdfItem[];
}

// Constancia de traspaso de stock entre sucursales. Documento interno sin importes
// (mismo espiritu que el "Remito de traslado" de ventas, pero para movimientos
// de stock entre sucursales, no atados a una venta).
@Injectable({ providedIn: 'root' })
export class StockTransferPdfService {
  constructor(
    private readonly brandingService: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {}

  async generate(ctx: StockTransferPdfContext): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;

    const itemColumns: PdfTableColumn[] = [
      { header: '#', width: 12 },
      { header: 'Codigo', width: 32 },
      { header: 'Producto', width: 108 },
      { header: 'Cant.', width: 18, align: 'right' }
    ];
    const itemTableColumns = this.pdfLayout.resolveColumns(margin, itemColumns);
    const [numberCol, codeCol, productCol, quantityCol] = itemTableColumns;

    const now = new Date();
    const formatDate = (value: Date): string =>
      value.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

    let y = margin;

    const drawDocumentHeader = (continuation = false): void => {
      this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.brandingService.drawHeader(doc, branding, {
        title: continuation ? 'Constancia de traspaso / Continuacion' : 'Constancia de traspaso de stock',
        subtitle: `Fecha: ${formatDate(now)}`,
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
        ['Origen', ctx.sourceBranchName],
        ['Destino', ctx.destinationBranchName]
      ];
      const rowsRight: [string, string][] = [
        ['Items', `${ctx.items.length}`],
        ['Notas', ctx.description || '-']
      ];

      const rowCount = Math.max(rowsLeft.length, rowsRight.length);
      const rowHeight = 6.5;
      const metaTop = y;
      const metaHeight = rowCount * rowHeight + 6;
      const halfWidth = contentWidth / 2;
      const leftX = margin + 3;
      const rightX = margin + halfWidth + 3;
      const valueOffset = 19;

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
      doc.text(this.pdfLayout.splitCellText(doc, rowValues[1], codeCol), codeCol.x + 2, y + 4.6);
      doc.text(this.pdfLayout.splitCellText(doc, rowValues[2], productCol), productCol.x + 2, y + 4.6);
      doc.text(rowValues[3], quantityCol.x + quantityCol.width - 2, y + rowHeight / 2 + 1.2, { align: 'right' });

      y += rowHeight;
    };

    ctx.items.forEach((item, index) => {
      drawItemRow([`${index + 1}`, item.code, item.name, `${item.quantity}`]);
    });

    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, 'Constancia de traspaso interno - sin valor fiscal');

    doc.save(`traspaso-stock-${now.toISOString().slice(0, 10)}.pdf`);
  }
}
