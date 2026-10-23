import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AccountLedger, AccountLedgerLabels } from '../../core/models/account-ledger.models';
import { formatMoney } from '../utils/money.util';
import { formatLedgerDate, rowDetail, rowTitle } from '../utils/ledger-format.util';
import { PdfBrandingService } from './pdf-branding.service';

// Exporta el extracto de cuenta corriente tal como se ve en pantalla (mismo rango, mismos anulados):
// Excel con los importes como números (para que el contador pueda sumar) y PDF para mandar al proveedor
// o al cliente y conciliar.
@Injectable({ providedIn: 'root' })
export class AccountLedgerExportService {
  constructor(private readonly brandingService: PdfBrandingService) {}

  exportExcel(ledger: AccountLedger, labels: AccountLedgerLabels): void {
    const header = ['Fecha', 'Comprobante', 'Detalle', 'Debe', 'Haber', 'Saldo', 'Estado'];
    const rows: (string | number)[][] = [];

    if (ledger.dateFrom) {
      rows.push([formatLedgerDate(ledger.dateFrom), 'Saldo anterior', '', '', '', ledger.openingBalance, '']);
    }
    for (const row of ledger.rows) {
      rows.push([
        formatLedgerDate(row.date),
        rowTitle(row, labels),
        rowDetail(row),
        row.debit || '',
        row.credit || '',
        row.balance,
        row.isCancelled ? 'Anulado' : ''
      ]);
    }
    rows.push(['', 'Totales del período', '', ledger.totalDebit, ledger.totalCredit, ledger.closingBalance, '']);

    const pendingHeader = ['Fecha', 'Comprobante', 'Factura', 'Total', 'Imputado', 'Saldo', 'Antigüedad (días)'];
    const pendingRows = ledger.pending.map(p => [
      formatLedgerDate(p.date), p.code, p.document ?? '', p.total, p.imputed, p.pending, p.ageDays
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Extracto');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([pendingHeader, ...pendingRows]), 'Pendientes');
    XLSX.writeFile(workbook, `${this.fileName(ledger, labels)}.xlsx`, { compression: true });
  }

  async exportPdf(ledger: AccountLedger, labels: AccountLedgerLabels): Promise<void> {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const branding = await this.brandingService.prepare();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const bottom = pageHeight - 18;
    const rowHeight = 7;

    // Columnas: fecha · comprobante · detalle · debe · haber · saldo (los importes alineados a la derecha).
    const cols = { date: margin + 2, code: margin + 22, detail: margin + 50, debit: 142, credit: 167, balance: pageWidth - margin - 2 };
    const title = `Extracto de cuenta · ${ledger.accountName}`;
    const subtitle = this.periodLabel(ledger);

    let y = 0;
    const startPage = (continuation: boolean): void => {
      if (continuation) doc.addPage();
      this.brandingService.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.brandingService.drawHeader(doc, branding, { title, subtitle, continuation, margin, y: margin, pageWidth }) + 4;
      doc.setFillColor(246, 246, 246);
      doc.setDrawColor(205, 205, 205);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      doc.text('Fecha', cols.date, y + 4.8);
      doc.text('Comprobante', cols.code, y + 4.8);
      doc.text('Detalle', cols.detail, y + 4.8);
      doc.text('Debe', cols.debit, y + 4.8, { align: 'right' });
      doc.text('Haber', cols.credit, y + 4.8, { align: 'right' });
      doc.text('Saldo', cols.balance, y + 4.8, { align: 'right' });
      y += rowHeight;
    };

    const line = (cells: { date?: string; code: string; detail?: string; debit?: number; credit?: number; balance: number },
                  style: { bold?: boolean; muted?: boolean } = {}): void => {
      if (y + rowHeight > bottom) startPage(true);
      doc.setDrawColor(225, 225, 225);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      doc.setFont('helvetica', style.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(style.muted ? 150 : 25, style.muted ? 150 : 25, style.muted ? 150 : 25);
      const baseline = y + 4.8;
      if (cells.date) doc.text(cells.date, cols.date, baseline);
      doc.text(cells.code, cols.code, baseline, { maxWidth: cols.detail - cols.code - 2 });
      if (cells.detail) doc.text(cells.detail, cols.detail, baseline, { maxWidth: cols.debit - cols.detail - 20 });
      if (cells.debit) doc.text(formatMoney(cells.debit), cols.debit, baseline, { align: 'right' });
      if (cells.credit) doc.text(formatMoney(cells.credit), cols.credit, baseline, { align: 'right' });
      doc.text(formatMoney(cells.balance), cols.balance, baseline, { align: 'right' });
      y += rowHeight;
    };

    startPage(false);
    if (ledger.dateFrom) {
      line({ date: formatLedgerDate(ledger.dateFrom), code: 'Saldo anterior', balance: ledger.openingBalance }, { bold: true });
    }
    for (const row of ledger.rows) {
      line({
        date: formatLedgerDate(row.date),
        code: rowTitle(row, labels),
        detail: row.isCancelled ? `ANULADO · ${rowDetail(row)}` : rowDetail(row),
        debit: row.debit,
        credit: row.credit,
        balance: row.balance
      }, { muted: row.isCancelled });
    }
    line({ code: 'Totales', debit: ledger.totalDebit, credit: ledger.totalCredit, balance: ledger.closingBalance }, { bold: true });

    y += 4;
    if (y + 10 > bottom) startPage(true);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    const closing = ledger.closingBalance;
    const verdict = closing > 0 ? 'Saldo adeudado' : closing < 0 ? 'Saldo a favor' : 'Cuenta saldada';
    doc.text(`${verdict}: $${formatMoney(Math.abs(closing))}`, pageWidth - margin, y + 4, { align: 'right' });

    this.brandingService.drawFooter(doc, pageWidth, pageHeight, margin, 'Extracto generado por el sistema');
    doc.save(`${this.fileName(ledger, labels)}.pdf`);
  }

  private periodLabel(ledger: AccountLedger): string {
    if (ledger.dateFrom && ledger.dateTo) return `Del ${formatLedgerDate(ledger.dateFrom)} al ${formatLedgerDate(ledger.dateTo)}`;
    if (ledger.dateFrom) return `Desde el ${formatLedgerDate(ledger.dateFrom)}`;
    if (ledger.dateTo) return `Hasta el ${formatLedgerDate(ledger.dateTo)}`;
    return 'Todos los movimientos';
  }

  private fileName(ledger: AccountLedger, labels: AccountLedgerLabels): string {
    const slug = ledger.accountName
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${labels.exportName}-${slug || ledger.accountId}`;
  }
}
