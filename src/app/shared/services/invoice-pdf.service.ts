import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';
import { SaleInvoicePrintResponse } from '../../core/models/sale.models';
import { PdfBrandingService, PreparedPdfBranding } from './pdf-branding.service';
import { PdfLayoutService, PdfResolvedTableColumn, PdfTableColumn } from './pdf-layout.service';

/**
 * PDF de la factura y la nota de credito electronicas con el diseno de EITI (logo, marca de agua).
 *
 * Los datos fiscales (letra, codigo, CAE, emisor, receptor, importes) son los que autorizo ARCA y
 * llegan resueltos del back. Los items vienen con IVA incluido, como se vendieron: en la Factura A
 * se muestran netos y el IVA se discrimina en los totales; en la B van con IVA y se agrega el
 * bloque de la Ley 27.743 (Regimen de Transparencia Fiscal al Consumidor).
 * Los totales siempre son los autorizados, no la suma de las lineas.
 */
@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  private readonly margin = 14;

  constructor(
    private readonly brandingService: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {}

  async generate(print: SaleInvoicePrintResponse): Promise<void> {
    // compress: sin esto jsPDF guarda el QR como bitmap crudo y una pagina pesa ~400 KB.
    const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
    const [branding, qrDataUrl] = await Promise.all([
      this.brandingService.prepare(),
      QRCode.toDataURL(print.qrUrl, { errorCorrectionLevel: 'M', margin: 0, width: 200 })
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = this.margin;
    const contentWidth = pageWidth - margin * 2;
    const printableBottom = pageHeight - 18;

    // En la A los importes de linea se muestran sin IVA; en la B, tal como se vendieron.
    const isA = print.letter === 'A';
    const toShown = (withVat: number): number => (isA ? withVat / (1 + print.vatRate / 100) : withVat);

    const columns: PdfTableColumn[] = [
      { header: '#', width: 10 },
      { header: 'Producto', width: 86 },
      { header: 'Cant.', width: 16, align: 'right' },
      { header: isA ? 'P. unit. (neto)' : 'P. unit.', width: 28, align: 'right' },
      { header: 'Bonif.', width: 16, align: 'right' },
      { header: isA ? 'Subtotal (neto)' : 'Subtotal', width: 26, align: 'right' }
    ];
    const tableColumns = this.pdfLayout.resolveColumns(margin, columns);

    let y = 10;

    const startPage = (continuation: boolean): void => {
      if (continuation) {
        doc.addPage();
      }
      this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = continuation
        ? this.drawContinuationHeader(doc, print, margin, contentWidth)
        : this.drawFiscalHeader(doc, print, branding, margin, contentWidth, pageWidth);
    };

    const drawItemsHeader = (): void => {
      y = this.pdfLayout.drawTableHeader(doc, tableColumns, y, { tableWidth: contentWidth, height: 8, fontSize: 8.4 });
    };

    const ensureSpace = (height: number, withTableHeader: boolean): void => {
      if (y + height > printableBottom) {
        startPage(true);
        if (withTableHeader) {
          drawItemsHeader();
        }
      }
    };

    startPage(false);
    y = this.drawReceiver(doc, print, margin, contentWidth, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.text('Detalle', margin, y);
    y += 4;
    drawItemsHeader();

    print.items.forEach((item, index) => {
      const values = [
        `${index + 1}`,
        item.description,
        `${item.quantity}`,
        this.money(toShown(item.unitPrice)),
        item.discountPercent > 0 ? `${this.percent(item.discountPercent)}%` : '-',
        this.money(toShown(item.total))
      ];
      const rowHeight = this.pdfLayout.measureTableRowHeight(doc, tableColumns, values, {
        tableWidth: contentWidth,
        wrap: true,
        minHeight: 8,
        lineHeight: 3.8,
        fontSize: 8.4
      });
      ensureSpace(rowHeight, true);
      this.drawItemRow(doc, tableColumns, values, y, rowHeight);
      y += rowHeight;
    });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(isA ? 'Importes sin IVA.' : 'Importes con IVA incluido.', margin, y + 4);
    y += 8;

    y = this.drawAdjustments(doc, print, toShown, margin, contentWidth, y, ensureSpace);
    ensureSpace(isA ? 40 : 48, false);
    y = this.drawTotals(doc, print, margin, contentWidth, y);

    ensureSpace(40, false);
    y = this.drawAuthorization(doc, print, qrDataUrl, margin, contentWidth, y);

    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, 'Comprobante electrónico autorizado por ARCA');

    const kind = print.kind === 'invoice' ? 'factura' : 'nota-de-credito';
    doc.save(`${kind}-${print.letter}-${this.pad(print.pointOfSale, 5)}-${this.pad(print.number, 8)}.pdf`);
  }

  /**
   * Encabezado fiscal: emisor a la izquierda, recuadro con la letra y el codigo al centro,
   * datos del comprobante a la derecha. Es el formato que exige ARCA para el comprobante.
   */
  private drawFiscalHeader(
    doc: jsPDF,
    print: SaleInvoicePrintResponse,
    branding: PreparedPdfBranding,
    margin: number,
    contentWidth: number,
    pageWidth: number
  ): number {
    const top = 10;
    const height = 46;
    const centerX = pageWidth / 2;

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.rect(margin, top, contentWidth, height);
    doc.line(centerX, top + 16, centerX, top + height);

    // Recuadro con la letra y el codigo de comprobante.
    const boxSize = 16;
    doc.setFillColor(255, 255, 255);
    doc.rect(centerX - boxSize / 2, top, boxSize, boxSize, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text(print.letter, centerX, top + 10.5, { align: 'center' });
    doc.setFontSize(6);
    doc.text(`COD. ${this.pad(print.typeCode, 3)}`, centerX, top + 14.2, { align: 'center' });

    // Emisor.
    const leftX = margin + 3;
    const leftWidth = centerX - boxSize / 2 - leftX - 3;
    let textX = leftX;
    if (branding.logo) {
      this.brandingService.drawContainedImage(doc, branding.logo, leftX, top + 3, 16, 16);
      textX = leftX + 19;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);
    doc.text(doc.splitTextToSize(print.issuer.legalName, leftWidth - (textX - leftX))[0], textX, top + 8);

    const issuerLines = [
      `CUIT: ${print.issuer.cuit}`,
      print.issuer.iibb ? `Ingresos Brutos: ${print.issuer.iibb}` : null,
      `Condición frente al IVA: ${print.issuer.vatCondition}`,
      `Inicio de actividades: ${this.date(print.issuer.activityStartDate)}`,
      print.issuer.commercialAddress ? `Domicilio comercial: ${print.issuer.commercialAddress}` : null
    ].filter((line): line is string => line !== null);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(60, 60, 60);
    let lineY = top + 22;
    for (const line of issuerLines) {
      const wrapped = doc.splitTextToSize(line, leftWidth);
      doc.text(wrapped, leftX, lineY);
      lineY += wrapped.length * 3.6;
    }

    // Comprobante.
    const rightX = centerX + boxSize / 2 + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(print.title, rightX, top + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('ORIGINAL', margin + contentWidth - 3, top + 5, { align: 'right' });

    const documentLines = [
      `Punto de venta: ${this.pad(print.pointOfSale, 5)}    Comp. Nro: ${this.pad(print.number, 8)}`,
      `Fecha de emisión: ${this.date(print.date)}`,
      `Condición de venta: ${print.saleCondition}`,
      `Venta: ${print.saleCode}`
    ];
    doc.setFontSize(7.8);
    doc.setTextColor(60, 60, 60);
    lineY = top + 22;
    for (const line of documentLines) {
      doc.text(line, rightX, lineY);
      lineY += 3.6;
    }
    if (print.isVoided) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(160, 60, 40);
      doc.text('Anulada mediante nota de crédito', rightX, lineY + 1);
    }

    return top + height + 5;
  }

  private drawContinuationHeader(doc: jsPDF, print: SaleInvoicePrintResponse, margin: number, contentWidth: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.text(`${print.title} ${print.letter} ${this.pad(print.pointOfSale, 5)}-${this.pad(print.number, 8)} (continuación)`, margin, 16);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 19, margin + contentWidth, 19);
    return 25;
  }

  private drawReceiver(doc: jsPDF, print: SaleInvoicePrintResponse, margin: number, contentWidth: number, y: number): number {
    const rows: [string, string][] = [
      ['Cliente', print.receiver.name],
      ['Condición frente al IVA', print.receiver.vatCondition]
    ];
    if (print.receiver.identification) {
      const [label, ...value] = print.receiver.identification.split(': ');
      rows.push([label, value.join(': ')]);
    }
    if (print.associatedDocument) {
      const associated = print.associatedDocument;
      rows.push([
        'Comprobante asociado',
        `${associated.label} ${this.pad(associated.pointOfSale, 5)}-${this.pad(associated.number, 8)} del ${this.date(associated.date)}`
      ]);
    }

    const rowHeight = 5.2;
    const height = rows.length * rowHeight + 4;
    doc.setDrawColor(185, 185, 185);
    doc.rect(margin, y, contentWidth, height);
    doc.setFontSize(8.6);
    rows.forEach(([label, value], index) => {
      const rowY = y + 5 + index * rowHeight;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 70);
      doc.text(`${label}:`, margin + 3, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(25, 25, 25);
      doc.text(value, margin + 44, rowY, { maxWidth: contentWidth - 48 });
    });
    return y + height + 7;
  }

  private drawItemRow(doc: jsPDF, columns: PdfResolvedTableColumn[], values: string[], y: number, rowHeight: number): void {
    doc.setDrawColor(205, 205, 205);
    for (const column of columns) {
      doc.rect(column.x, y, column.width, rowHeight);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(25, 25, 25);
    const middle = y + rowHeight / 2 + 1.2;
    columns.forEach((column, index) => {
      if (index === 1) {
        doc.text(this.pdfLayout.splitCellText(doc, values[index], column), column.x + 2, y + 4.6);
      } else if (column.align === 'right') {
        doc.text(values[index], column.x + column.width - 2, middle, { align: 'right' });
      } else {
        doc.text(values[index], column.x + 2, middle);
      }
    });
  }

  /** Lo que lleva de la suma de las lineas al total facturado: recargo, bonificacion general o precio acordado. */
  private drawAdjustments(
    doc: jsPDF,
    print: SaleInvoicePrintResponse,
    toShown: (withVat: number) => number,
    margin: number,
    contentWidth: number,
    y: number,
    ensureSpace: (height: number, withTableHeader: boolean) => void
  ): number {
    const adjustments = print.adjustments;
    const lines: [string, string][] = [];
    const base = adjustments.itemsSubtotal + adjustments.noDeliverySurcharge;
    if (adjustments.noDeliverySurcharge > 0) {
      lines.push(['Recargo sin envío', this.money(toShown(adjustments.noDeliverySurcharge))]);
    }
    if (adjustments.generalDiscountPercent > 0) {
      const discount = base * adjustments.generalDiscountPercent / 100;
      lines.push([`Bonificación general ${this.percent(adjustments.generalDiscountPercent)}%`, `-${this.money(toShown(discount))}`]);
    }
    if (adjustments.agreedPrice !== null && adjustments.agreedPrice !== undefined) {
      lines.push(['Precio acordado', this.money(toShown(adjustments.agreedPrice))]);
    }
    if (lines.length === 0) {
      return y;
    }

    ensureSpace(lines.length * 5 + 4, false);
    const labelX = margin + contentWidth - 75;
    const valueX = margin + contentWidth - 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(60, 60, 60);
    for (const [label, value] of lines) {
      doc.text(label, labelX, y);
      doc.text(value, valueX, y, { align: 'right' });
      y += 5;
    }
    return y + 2;
  }

  private drawTotals(doc: jsPDF, print: SaleInvoicePrintResponse, margin: number, contentWidth: number, y: number): number {
    const amounts = print.amounts;
    const rows: [string, number, boolean][] = [];
    if (print.letter === 'A') {
      rows.push(['Importe neto gravado', amounts.net, false]);
      for (const vat of amounts.vat) {
        rows.push([`IVA ${this.percent(vat.rate)}%`, vat.amount, false]);
      }
    }
    if (amounts.exempt > 0) {
      rows.push(['Importe exento', amounts.exempt, false]);
    }
    rows.push(['Importe total', amounts.total, true]);

    const boxWidth = 80;
    const boxX = margin + contentWidth - boxWidth;
    const rowHeight = 6.2;
    const boxHeight = rows.length * rowHeight + 4;
    doc.setFillColor(246, 246, 246);
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 1.2, 1.2, 'FD');
    rows.forEach(([label, value, emphasis], index) => {
      const rowY = y + 6 + index * rowHeight;
      doc.setFont('helvetica', emphasis ? 'bold' : 'normal');
      doc.setFontSize(emphasis ? 11 : 9);
      doc.setTextColor(35, 35, 35);
      doc.text(label, boxX + 3, rowY);
      doc.text(this.money(value), boxX + boxWidth - 3, rowY, { align: 'right' });
    });

    if (print.letter === 'B') {
      // Ley 27.743: en comprobantes B se informa el IVA contenido y los otros impuestos nacionales
      // indirectos. El sistema no liquida otros impuestos, por eso ese renglon va en 0.
      const vatContained = amounts.vat.reduce((sum, vat) => sum + vat.amount, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(50, 50, 50);
      doc.text('Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)', margin, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('IVA contenido:', margin, y + 10);
      doc.text(this.money(vatContained), margin + 62, y + 10, { align: 'right' });
      doc.text('Otros impuestos nacionales indirectos:', margin, y + 14.5);
      doc.text(this.money(0), margin + 62, y + 14.5, { align: 'right' });
    }

    return y + Math.max(boxHeight, print.letter === 'B' ? 18 : 0) + 8;
  }

  private drawAuthorization(
    doc: jsPDF,
    print: SaleInvoicePrintResponse,
    qrDataUrl: string,
    margin: number,
    contentWidth: number,
    y: number
  ): number {
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, margin + contentWidth, y);
    const qrSize = 30;
    const top = y + 4;
    doc.addImage(qrDataUrl, 'PNG', margin, top, qrSize, qrSize);

    const textX = margin + qrSize + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.text(`CAE N°: ${print.authorizationCode}`, textX, top + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha de vto. de CAE: ${this.date(print.authorizationExpiry)}`, textX, top + 15);
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text('Comprobante autorizado por ARCA', textX, top + 21);
    return top + qrSize + 4;
  }

  private money(value: number): string {
    return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private percent(value: number): string {
    return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  // Las fechas llegan como 'YYYY-MM-DD' (DateOnly): se formatean sin pasar por Date para no correr el dia por huso.
  private date(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  private pad(value: number, length: number): string {
    return String(value).padStart(length, '0');
  }
}
