import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

export type PdfTextAlign = 'left' | 'right' | 'center';

export interface PdfTableColumn {
  header: string;
  width: number;
  align?: PdfTextAlign;
}

export interface PdfResolvedTableColumn extends PdfTableColumn {
  x: number;
}

export interface PdfTableHeaderOptions {
  tableWidth: number;
  height?: number;
  fontSize?: number;
}

export interface PdfTableRowOptions {
  tableWidth: number;
  height?: number;
  minHeight?: number;
  fontSize?: number;
  lineHeight?: number;
  maxLines?: number;
  alternate?: boolean;
  total?: boolean;
  wrap?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PdfLayoutService {
  readonly defaultBottomReserve = 16;

  resolveColumns(startX: number, columns: PdfTableColumn[]): PdfResolvedTableColumn[] {
    let x = startX;
    return columns.map(column => {
      const resolved = { ...column, x };
      x += column.width;
      return resolved;
    });
  }

  ensurePageSpace(doc: jsPDF, y: number, requiredHeight: number, pageHeight: number, onNewPage: () => number, bottomReserve = this.defaultBottomReserve): number {
    if (y + requiredHeight <= pageHeight - bottomReserve) {
      return y;
    }

    doc.addPage();
    return onNewPage();
  }

  drawTableHeader(doc: jsPDF, columns: PdfResolvedTableColumn[], y: number, options: PdfTableHeaderOptions): number {
    const height = options.height ?? 7;
    const fontSize = options.fontSize ?? 7.4;
    const x = columns[0]?.x ?? 0;

    doc.setFillColor(235, 232, 225);
    doc.setDrawColor(206, 202, 192);
    doc.roundedRect(x, y, options.tableWidth, height, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(62, 62, 62);
    columns.forEach(column => this.drawCellText(doc, column.header, column, y + height - 2.3));
    return y + height;
  }

  drawTableRow(doc: jsPDF, columns: PdfResolvedTableColumn[], values: string[], y: number, options: PdfTableRowOptions): number {
    const height = options.height ?? this.measureTableRowHeight(doc, columns, values, options);
    const fontSize = options.fontSize ?? 7.4;
    const x = columns[0]?.x ?? 0;

    if (options.alternate || options.total) {
      const fill = options.total ? [244, 239, 229] : [249, 248, 245];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(x, y, options.tableWidth, height, 'F');
    }

    doc.setFont('helvetica', options.total ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(35, 35, 35);
    columns.forEach((column, index) => {
      if (options.wrap) {
        this.drawWrappedCellText(doc, values[index] ?? '', column, y + 4, options);
        return;
      }
      this.drawCellText(doc, values[index] ?? '', column, y + height - 2);
    });
    return y + height;
  }

  drawTableRowBackground(doc: jsPDF, x: number, y: number, width: number, height: number, options: Pick<PdfTableRowOptions, 'alternate' | 'total'>): void {
    if (!options.alternate && !options.total) {
      return;
    }

    const fill = options.total ? [244, 239, 229] : [249, 248, 245];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(x, y, width, height, 'F');
  }

  drawTableSeparator(doc: jsPDF, x: number, y: number, width: number): void {
    doc.setDrawColor(228, 228, 226);
    doc.line(x, y, x + width, y);
  }

  measureTableRowHeight(doc: jsPDF, columns: PdfResolvedTableColumn[], values: string[], options: PdfTableRowOptions): number {
    if (!options.wrap) {
      return options.minHeight ?? 6;
    }

    const lineHeight = options.lineHeight ?? 3.4;
    const maxLines = Math.max(1, options.maxLines ?? Number.MAX_SAFE_INTEGER);
    const lines = columns.map((column, index) => {
      const value = values[index] ?? '';
      return Math.min(this.cellLines(doc, value, column, maxLines).length, maxLines);
    });
    return Math.max(options.minHeight ?? 6, Math.max(...lines) * lineHeight + 2.4);
  }

  splitCellText(doc: jsPDF, value: string, column: PdfResolvedTableColumn, maxLines = Number.MAX_SAFE_INTEGER): string[] {
    return this.cellLines(doc, value, column, Math.max(1, maxLines));
  }

  private drawCellText(doc: jsPDF, value: string, column: PdfResolvedTableColumn, y: number): void {
    const padding = 1.5;
    const text = (doc.splitTextToSize(value, column.width - padding * 2) as string[])[0] ?? '';
    if (column.align === 'right') {
      doc.text(text, column.x + column.width - padding, y, { align: 'right' });
      return;
    }
    if (column.align === 'center') {
      doc.text(text, column.x + column.width / 2, y, { align: 'center' });
      return;
    }
    doc.text(text, column.x + padding, y);
  }

  private drawWrappedCellText(doc: jsPDF, value: string, column: PdfResolvedTableColumn, y: number, options: PdfTableRowOptions): void {
    const padding = 1.5;
    const lines = this.cellLines(doc, value, column, Math.max(1, options.maxLines ?? Number.MAX_SAFE_INTEGER));
    if (column.align === 'right') {
      doc.text(lines, column.x + column.width - padding, y, { align: 'right' });
      return;
    }
    if (column.align === 'center') {
      doc.text(lines, column.x + column.width / 2, y, { align: 'center' });
      return;
    }
    doc.text(lines, column.x + padding, y);
  }

  private cellLines(doc: jsPDF, value: string, column: PdfResolvedTableColumn, maxLines: number): string[] {
    const padding = 1.5;
    const lines = doc.splitTextToSize(value, column.width - padding * 2) as string[];
    return (lines.length > 0 ? lines : ['']).slice(0, maxLines);
  }
}
