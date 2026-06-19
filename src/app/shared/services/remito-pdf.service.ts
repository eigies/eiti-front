import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfBrandingService } from './pdf-branding.service';

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
  constructor(private readonly brandingService: PdfBrandingService) {}

  async generate(sale: RemitoSale, ctx: RemitoContext, incluirImportes: boolean): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;

    // Columnas: con importes (#, Producto, Cant., Unitario, Subtotal); traslado (#, Producto, Cant.).
    const colWidths = incluirImportes ? [12, 84, 18, 34, 34] : [12, 152, 18];
    const colX: number[] = [];
    colWidths.reduce((acc, w, i) => { colX[i] = acc; return acc + w; }, margin);

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

      doc.setFillColor(232, 232, 232);
      doc.setDrawColor(170, 170, 170);
      doc.rect(margin, y, contentWidth, 8, 'FD');

      doc.setFontSize(8.6);
      doc.text('#', colX[0] + 2, y + 5.3);
      doc.text('Producto', colX[1] + 2, y + 5.3);
      doc.text('Cant.', colX[2] + colWidths[2] - 2, y + 5.3, { align: 'right' });
      if (incluirImportes) {
        doc.text('Unitario', colX[3] + colWidths[3] - 2, y + 5.3, { align: 'right' });
        doc.text('Subtotal', colX[4] + colWidths[4] - 2, y + 5.3, { align: 'right' });
      }

      y += 8;
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

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);

    for (let index = 0; index < sale.details.length; index += 1) {
      const detail = sale.details[index];
      const productText = `${detail.productBrand} / ${detail.productName}`;
      const wrappedProduct = doc.splitTextToSize(productText, colWidths[1] - 4) as string[];
      const rowHeight = Math.max(8, wrappedProduct.length * 3.8 + 2.5);

      if (y + rowHeight > printableBottom) {
        startDetailsPage(true);
      }

      doc.setDrawColor(205, 205, 205);
      for (let c = 0; c < colWidths.length; c += 1) {
        doc.rect(colX[c], y, colWidths[c], rowHeight);
      }

      doc.text(`${index + 1}`, colX[0] + 2, y + rowHeight / 2 + 1.2);
      doc.text(wrappedProduct, colX[1] + 2, y + 4.6);
      doc.text(`${detail.quantity}`, colX[2] + colWidths[2] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
      if (incluirImportes) {
        doc.text(formatCurrency(detail.unitPrice), colX[3] + colWidths[3] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
        doc.text(formatCurrency(detail.totalAmount), colX[4] + colWidths[4] - 2, y + rowHeight / 2 + 1.2, { align: 'right' });
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
