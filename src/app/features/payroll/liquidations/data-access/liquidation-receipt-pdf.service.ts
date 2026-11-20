import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PayrollLiquidationResponse } from '../../../../core/models/payroll.models';
import { PdfBrandingService } from '../../../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../../shared/services/toast.service';

/** Lo que el recibo toma de la pantalla (nombre del empleado, medio de pago y totales). */
export interface LiquidationReceiptView {
  employeeName: string;
  paymentMethodLabel: string;
  lineTotal: (lines: Array<{ amount: number }>) => number;
}

/** Recibo de sueldo en PDF: el mismo código de armado que tenía LiquidationsComponent. */
@Injectable()
export class LiquidationReceiptPdfService {
  constructor(
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService,
    private readonly toast: ToastService
  ) {}

  async export(liquidation: PayrollLiquidationResponse, view: LiquidationReceiptView): Promise<void> {
    try {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const branding = await this.pdfBranding.prepare();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const tableWidth = pageWidth - margin * 2;
      let y = 16;

      const drawHeader = (continuation = false): void => {
        this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
        y = this.pdfBranding.drawHeader(doc, branding, {
          title: 'Recibo de sueldo',
          subtitle: `${view.employeeName} / Periodo ${liquidation.periodLabel}`,
          continuation,
          margin,
          y: 12,
          pageWidth
        });
      };

      const drawInfo = (): void => {
        doc.setFillColor(244, 239, 229);
        doc.setDrawColor(221, 206, 180);
        doc.roundedRect(margin, y, tableWidth, 24, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120, 88, 33);
        doc.text('Empleado', margin + 4, y + 6);
        doc.text('Periodo', margin + 70, y + 6);
        doc.text('Fecha de pago', margin + 112, y + 6);
        doc.text('Medio de pago', margin + 150, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(35, 35, 35);
        doc.text(view.employeeName, margin + 4, y + 13, { maxWidth: 60 });
        doc.text(liquidation.periodLabel, margin + 70, y + 13);
        doc.text(liquidation.paidAt ? new Date(liquidation.paidAt).toLocaleString('es-AR') : '-', margin + 112, y + 13);
        doc.text(view.paymentMethodLabel, margin + 150, y + 13);
        y += 31;
      };

      const drawTable = (title: string, rows: Array<{ label: string; amount: number }>): void => {
        const columns = this.pdfLayout.resolveColumns(margin, [
          { header: title, width: tableWidth - 42 },
          { header: 'Importe', width: 42, align: 'right' }
        ] satisfies PdfTableColumn[]);
        const requiredHeight = 9 + Math.max(1, rows.length) * 7 + 8;
        y = this.pdfLayout.ensurePageSpace(doc, y, requiredHeight, pageHeight, () => {
          drawHeader(true);
          return y;
        });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(35, 35, 35);
        doc.text(title, margin, y);
        y += 4;
        y = this.pdfLayout.drawTableHeader(doc, columns, y, { tableWidth });
        const data = rows.length > 0 ? rows : [{ label: 'Sin movimientos', amount: 0 }];
        data.forEach((line, index) => {
          y = this.pdfLayout.drawTableRow(
            doc,
            columns,
            [line.label, this.money(line.amount)],
            y,
            { tableWidth, alternate: index % 2 === 0 }
          );
        });
        y = this.pdfLayout.drawTableRow(
          doc,
          columns,
          ['Total', this.money(view.lineTotal(rows))],
          y,
          { tableWidth, total: true }
        ) + 6;
      };

      drawHeader();
      drawInfo();
      drawTable('Descuentos', liquidation.deductionLines);
      drawTable('Bonificaciones', liquidation.bonusLines);
      drawTable('Adelantos', liquidation.advanceLines);

      y = this.pdfLayout.ensurePageSpace(doc, y, 24, pageHeight, () => {
        drawHeader(true);
        return y;
      });
      const totalColumns = this.pdfLayout.resolveColumns(margin, [
        { header: 'Concepto', width: tableWidth - 42 },
        { header: 'Importe', width: 42, align: 'right' }
      ] satisfies PdfTableColumn[]);
      y = this.pdfLayout.drawTableHeader(doc, totalColumns, y, { tableWidth });
      y = this.pdfLayout.drawTableRow(doc, totalColumns, ['Bruto', this.money(liquidation.grossAmount)], y, { tableWidth });
      this.pdfLayout.drawTableRow(doc, totalColumns, ['Neto a pagar', this.money(liquidation.netAmount)], y, { tableWidth, total: true });

      this.pdfBranding.drawFooter(doc, pageWidth, pageHeight, margin, `Recibo de sueldo / ${liquidation.periodLabel}`);
      doc.save(`recibo_sueldo_${this.fileSafe(view.employeeName)}_${this.fileSafe(liquidation.periodLabel)}.pdf`);
    } catch {
      this.toast.error('No se pudo generar el recibo PDF');
    }
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
  }

  private fileSafe(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}
