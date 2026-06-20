import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfBrandingService } from './pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from './pdf-layout.service';

// Datos mínimos que el remito necesita de una venta (compatible con SaleResponse y SaleByIdResponse).
export interface RemitoSaleDetail {
  productBrand: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface RemitoSale {
  id: string;
  code?: string | null;
  createdAt: string;
  customerFullName?: string | null;
  customerDocument?: string | null;
  customerTaxId?: string | null;
  hasDelivery: boolean;
  totalAmount: number;
  details: RemitoSaleDetail[];
}

export interface RemitoContext {
  branchName: string;
  statusLabel: string;
  paymentSummary?: string;   // solo se usa con importes
  coveredAmount?: number;    // solo se usa con importes
}

// Generador único del remito de la venta. Con `incluirImportes=false` produce el "Remito de traslado"
// sin precios (oculta columnas Unitario/Subtotal, caja TOTAL y la info de pago/cobrado).
@Injectable({ providedIn: 'root' })
export class RemitoPdfService {
  constructor(
    private readonly brandingService: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {}

  async generate(sale: RemitoSale, ctx: RemitoContext, incluirImportes: boolean): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;

    // Columnas: con importes (#, Producto, Cant., Unitario, Subtotal); traslado (#, Producto, Cant.).
    const itemColumns: PdfTableColumn[] = incluirImportes
      ? [
        { header: '#', width: 12 },
        { header: 'Producto', width: 84 },
        { header: 'Cant.', width: 18, align: 'right' },
        { header: 'Unitario', width: 34, align: 'right' },
        { header: 'Subtotal', width: 34, align: 'right' }
      ]
      : [
        { header: '#', width: 12 },
        { header: 'Producto', width: 152 },
        { header: 'Cant.', width: 18, align: 'right' }
      ];
    const itemTableColumns = this.pdfLayout.resolveColumns(margin, itemColumns);
    const [numberCol, productCol, quantityCol, unitCol, subtotalCol] = itemTableColumns;

    const formatCurrency = (value: number): string =>
      `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (value: string): string =>
      new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

    const docTitle = incluirImportes ? 'Comprobante de venta' : 'Remito de traslado';
    const nro = sale.code || sale.id;

    let y = margin;

    const drawDocumentHeader = (continuation = false): void => {
      this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.brandingService.drawHeader(doc, branding, {
        title: continuation ? `${docTitle} / Continuacion` : docTitle,
        subtitle: `Nro. ${nro} · Fecha venta: ${formatDate(sale.createdAt)}`,
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
        ['Sucursal', ctx.branchName],
        ['Cliente', sale.customerFullName || '-'],
        ['Documento', sale.customerDocument || sale.customerTaxId || '-']
      ];
      const rowsRight: [string, string][] = [
        ['Estado', ctx.statusLabel],
        ['Entrega', sale.hasDelivery ? 'Con envio' : 'Retiro en local'],
        ['Items', `${sale.details.length}`]
      ];
      if (incluirImportes) {
        rowsLeft.push(['Pago', ctx.paymentSummary ?? '-']);
        rowsRight.push(['Cobrado', formatCurrency(ctx.coveredAmount ?? 0)]);
      }

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

    for (let index = 0; index < sale.details.length; index += 1) {
      const detail = sale.details[index];
      const productText = `${detail.productBrand} / ${detail.productName}`;
      const rowValues = [
        `${index + 1}`,
        productText,
        `${detail.quantity}`,
        ...(incluirImportes ? [formatCurrency(detail.unitPrice), formatCurrency(detail.totalAmount)] : [])
      ];
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
      if (incluirImportes) {
        doc.text(rowValues[3], unitCol.x + unitCol.width - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
        doc.text(rowValues[4], subtotalCol.x + subtotalCol.width - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
      }

      y += rowHeight;
    }

    if (incluirImportes) {
      if (y + 24 > printableBottom) {
        doc.addPage();
        y = margin;
        drawDocumentHeader(true);
      }
      const summaryWidth = 72;
      const summaryX = pageWidth - margin - summaryWidth;
      doc.setFillColor(246, 246, 246);
      doc.setDrawColor(150, 150, 150);
      doc.roundedRect(summaryX, y + 5, summaryWidth, 16, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 45, 45);
      doc.setFontSize(9.5);
      doc.text('TOTAL VENTA', summaryX + 3, y + 11);
      doc.setFontSize(12.5);
      doc.text(formatCurrency(sale.totalAmount), summaryX + summaryWidth - 3, y + 17, { align: 'right' });
    }

    const footerText = incluirImportes
      ? 'Documento para control interno de venta'
      : 'Remito de traslado - sin valor fiscal';
    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, footerText);

    const prefix = incluirImportes ? 'venta' : 'remito-traslado';
    doc.save(`${prefix}-${sale.createdAt.slice(0, 10)}.pdf`);
  }
}
