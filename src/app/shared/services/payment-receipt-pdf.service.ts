import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfBrandingService, PreparedPdfBranding } from './pdf-branding.service';

// Recibo de un cobro (cuenta corriente de cliente) o un pago (cuenta corriente de proveedor).
// Un mismo pago/cobro puede cubrir una o varias ventas/compras (imputaciones) - eso ya viene
// resuelto en `coverage`, este servicio solo lo imprime.
export interface PaymentReceiptCoverage {
  code: string;
  amount: number;
}

export interface PaymentReceiptSaleDetail {
  productBrand: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface PaymentReceiptSaleDetailSection {
  code: string;
  details: PaymentReceiptSaleDetail[];
}

export interface PaymentReceiptData {
  kind: 'cobro' | 'pago';
  partyLabel: 'Cliente' | 'Proveedor';
  partyName: string;
  amount: number;
  date: string;
  methodLabel: string;
  reference?: string | null;
  notes?: string | null;
  chequeNumero?: string | null;
  coverage: PaymentReceiptCoverage[];
  saleDetails?: PaymentReceiptSaleDetail[];
  saleDetailSections?: PaymentReceiptSaleDetailSection[];
  creditAdded?: number | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentReceiptPdfService {
  constructor(private readonly brandingService: PdfBrandingService) {}

  async generate(data: PaymentReceiptData): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    this.drawReceiptPage(doc, branding, data);
    doc.save(this.fileName(data));
  }

  async generateBatch(dataList: PaymentReceiptData[], fileName: string): Promise<void> {
    if (dataList.length === 0) { return; }
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    dataList.forEach((data, index) => {
      if (index > 0) { doc.addPage(); }
      this.drawReceiptPage(doc, branding, data);
    });
    doc.save(fileName);
  }

  private drawReceiptPage(doc: jsPDF, branding: PreparedPdfBranding, data: PaymentReceiptData): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const formatCurrency = (value: number): string =>
      `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (value: string): string => new Date(value).toLocaleDateString('es-AR');

    const title = data.kind === 'cobro' ? 'Recibo de cobro' : 'Recibo de pago';

    this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
    let y = this.brandingService.drawHeader(doc, branding, {
      title,
      subtitle: `Fecha: ${formatDate(data.date)}`,
      margin,
      y: margin,
      pageWidth
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`${data.partyLabel}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(25, 25, 25);
    doc.text(data.partyName, margin + 26, y);

    y += 8;
    doc.setFillColor(246, 246, 246);
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(margin, y, contentWidth, 22, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(45, 45, 45);
    doc.text(data.kind === 'cobro' ? 'MONTO COBRADO' : 'MONTO PAGADO', margin + 4, y + 9);
    doc.setFontSize(13);
    doc.text(formatCurrency(data.amount), pageWidth - margin - 4, y + 9, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Metodo: ${data.methodLabel}${data.chequeNumero ? ' - Cheque N° ' + data.chequeNumero : ''}`, margin + 4, y + 17);
    y += 30;

    if (data.coverage.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(25, 25, 25);
      doc.text('Corresponde a:', margin, y);
      y += 6;
      doc.setDrawColor(205, 205, 205);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const item of data.coverage) {
        doc.rect(margin, y, contentWidth, 7);
        doc.text(item.code, margin + 3, y + 4.8);
        doc.text(formatCurrency(item.amount), pageWidth - margin - 3, y + 4.8, { align: 'right' });
        y += 7;
      }
      y += 6;
    }

    const saleDetailSections: PaymentReceiptSaleDetailSection[] = (data.saleDetailSections?.length ?? 0) > 0
      ? data.saleDetailSections ?? []
      : (data.saleDetails?.length ?? 0) > 0
        ? [{ code: data.coverage[0]?.code ?? 'Venta', details: data.saleDetails ?? [] }]
        : [];

    if (saleDetailSections.length > 0) {
      const signatureTop = pageHeight - 50;
      const ensureSpace = (height: number): void => {
        if (y + height <= signatureTop) { return; }
        doc.addPage();
        this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
        y = this.brandingService.drawHeader(doc, branding, {
          title: `${title} / Continuacion`,
          subtitle: `Fecha: ${formatDate(data.date)}`,
          margin,
          y: margin,
          pageWidth
        }) + 6;
      };

      const columns = {
        productX: margin,
        productW: contentWidth - 74,
        quantityX: margin + contentWidth - 72,
        quantityW: 18,
        unitX: margin + contentWidth - 54,
        unitW: 27,
        totalX: margin + contentWidth - 27,
        totalW: 27
      };

      ensureSpace(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(25, 25, 25);
      doc.text('Detalle de venta', margin, y);
      y += 6;

      const drawDetailsHeader = (): void => {
        doc.setDrawColor(205, 205, 205);
        doc.setFillColor(246, 246, 246);
        doc.rect(margin, y, contentWidth, 7, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        doc.text('Producto', columns.productX + 2, y + 4.7);
        doc.text('Cant.', columns.quantityX + columns.quantityW - 2, y + 4.7, { align: 'right' });
        doc.text('Unitario', columns.unitX + columns.unitW - 2, y + 4.7, { align: 'right' });
        doc.text('Subtotal', columns.totalX + columns.totalW - 2, y + 4.7, { align: 'right' });
        y += 7;
      };

      for (const section of saleDetailSections) {
        ensureSpace(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(45, 45, 45);
        doc.text(section.code, margin, y);
        y += 5;
        drawDetailsHeader();

        for (const detail of section.details) {
          ensureSpace(8);
          const product = `${detail.productBrand} / ${detail.productName}`;
          doc.setDrawColor(205, 205, 205);
          doc.rect(margin, y, contentWidth, 8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.setTextColor(25, 25, 25);
          doc.text(product, columns.productX + 2, y + 5.2, { maxWidth: columns.productW - 4 });
          doc.text(`${detail.quantity}`, columns.quantityX + columns.quantityW - 2, y + 5.2, { align: 'right' });
          doc.text(formatCurrency(detail.unitPrice), columns.unitX + columns.unitW - 2, y + 5.2, { align: 'right' });
          doc.text(formatCurrency(detail.totalAmount), columns.totalX + columns.totalW - 2, y + 5.2, { align: 'right' });
          y += 8;
        }

        y += 4;
      }

      y += 2;
    }

    if (data.creditAdded && data.creditAdded > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text(`Excedente aplicado a saldo a favor: ${formatCurrency(data.creditAdded)}`, margin, y);
      y += 8;
    }

    if (data.reference || data.notes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      if (data.reference) { doc.text(`Referencia: ${data.reference}`, margin, y); y += 6; }
      if (data.notes) { doc.text(`Nota: ${data.notes}`, margin, y); y += 6; }
    }

    // Firmas: siempre al pie fijo de la pagina, no importa cuanto contenido haya arriba.
    const signatureY = pageHeight - 42;
    const signatureWidth = (contentWidth - 12) / 2;
    doc.setDrawColor(120, 120, 120);
    doc.line(margin, signatureY, margin + signatureWidth, signatureY);
    doc.line(margin + signatureWidth + 12, signatureY, margin + signatureWidth * 2 + 12, signatureY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`Firma ${data.partyLabel}`, margin, signatureY + 5);
    doc.text('Firma empleado', margin + signatureWidth + 12, signatureY + 5);

    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, 'Recibo generado por el sistema');
  }

  private fileName(data: PaymentReceiptData): string {
    const prefix = data.kind === 'cobro' ? 'recibo-cobro' : 'recibo-pago';
    return `${prefix}-${data.date.slice(0, 10)}.pdf`;
  }
}
