import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { CompanyResponse } from '../../core/models/company.models';
import { CompanyService } from '../../core/services/company.service';

export interface PreparedPdfImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

export interface PreparedPdfBranding {
  companyName: string;
  logo?: PreparedPdfImage | null;
  watermark?: PreparedPdfImage | null;
  eitiIcon?: PreparedPdfImage | null;
}

export interface PdfHeaderOptions {
  title: string;
  subtitle?: string;
  continuation?: boolean;
  margin: number;
  y: number;
  pageWidth: number;
}

@Injectable({ providedIn: 'root' })
export class PdfBrandingService {
  private readonly eitiIconPath = 'assets/brand/eiti-icon-light.svg';
  private cachedCompany: CompanyResponse | null = null;

  constructor(private readonly companyService: CompanyService) {}

  async prepare(): Promise<PreparedPdfBranding> {
    const company = await this.getCompany();
    const [logo, watermark, eitiIcon] = await Promise.all([
      this.prepareImage(company?.pdfLogoUrl),
      this.prepareImage(company?.pdfWatermarkUrl),
      this.prepareImage(this.eitiIconPath)
    ]);

    return {
      companyName: company?.name || 'EITI',
      logo,
      watermark,
      eitiIcon
    };
  }

  drawWatermark(doc: jsPDF, branding: PreparedPdfBranding, pageWidth: number, pageHeight: number): void {
    if (branding.watermark) {
      const image = branding.watermark;
      const targetWidth = Math.min(pageWidth * 0.62, 150);
      const targetHeight = targetWidth * (image.height / image.width);
      const x = (pageWidth - targetWidth) / 2;
      const y = (pageHeight - targetHeight) / 2;
      this.withOpacity(doc, 0.08, () => this.addImage(doc, image, x, y, targetWidth, targetHeight));
      return;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(235, 230, 220);
    doc.text(branding.companyName.toUpperCase(), pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: -35
    } as any);
  }

  drawHeader(doc: jsPDF, branding: PreparedPdfBranding, options: PdfHeaderOptions): number {
    const title = options.continuation ? `${options.title} / Continuacion` : options.title;
    const contentWidth = options.pageWidth - options.margin * 2;
    const y = options.y;
    const logoBox = 23;
    const logoDrawSize = branding.logo ? 17 : 14;
    const logoDrawY = branding.logo ? y - 1 : y + 1;
    const eitiIconSize = 11;
    const eitiIconX = options.pageWidth - options.margin - eitiIconSize - 3;
    const eitiIconY = y - 1;
    const dateRightX = eitiIconX - 5;
    const rightLogoBox = options.pageWidth - options.margin - dateRightX + 68;
    const textX = options.margin + logoBox + 4;
    const textMaxWidth = contentWidth - (textX - options.margin) - rightLogoBox - 4;

    doc.setDrawColor(226, 217, 202);
    doc.setFillColor(252, 249, 244);
    doc.roundedRect(options.margin, y - 4, contentWidth, 25, 2, 2, 'FD');

    if (branding.logo) {
      this.drawContainedImage(doc, branding.logo, options.margin + 3, logoDrawY, logoDrawSize, logoDrawSize);
    } else {
      doc.setFillColor(184, 111, 0);
      doc.roundedRect(options.margin + 4, logoDrawY, logoDrawSize, logoDrawSize, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(this.initials(branding.companyName), options.margin + 11, y + 9.2, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(28, 28, 28);
    doc.text(doc.splitTextToSize(title, textMaxWidth)[0] ?? title, textX, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(105, 105, 105);
    doc.text(branding.companyName, textX, y + 9.8, { maxWidth: textMaxWidth });
    if (options.subtitle) {
      doc.text(options.subtitle, textX, y + 15, { maxWidth: textMaxWidth });
    }

    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emitido: ${new Date().toLocaleString('es-AR')}`, dateRightX, y + 4, { align: 'right' });

    if (branding.eitiIcon) {
      this.drawContainedImage(doc, branding.eitiIcon, eitiIconX, eitiIconY, eitiIconSize, eitiIconSize);
    }

    return y + 29;
  }

  drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, text: string): void {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(218, 214, 207);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(125, 125, 125);
      doc.text(text, margin, pageHeight - 8);
      doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
  }

  private async getCompany(): Promise<CompanyResponse | null> {
    if (this.cachedCompany) {
      return this.cachedCompany;
    }

    try {
      this.cachedCompany = await firstValueFrom(this.companyService.getCurrentCompany());
      return this.cachedCompany;
    } catch {
      return null;
    }
  }

  private async prepareImage(value?: string | null): Promise<PreparedPdfImage | null> {
    const source = value?.trim();
    if (!source) {
      return null;
    }

    try {
      const rawDataUrl = source.startsWith('data:image/')
        ? source
        : await this.fetchAsDataUrl(source);
      const dataUrl = rawDataUrl.includes('image/svg+xml')
        ? await this.rasterizeSvg(rawDataUrl)
        : rawDataUrl;
      const size = await this.readImageSize(dataUrl);
      return {
        dataUrl,
        format: dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG',
        width: size.width,
        height: size.height
      };
    } catch {
      return null;
    }
  }

  private async fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Image request failed');
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private async readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  private async rasterizeSvg(dataUrl: string): Promise<string> {
    const size = await this.readImageSize(dataUrl);
    const canvas = document.createElement('canvas');
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    canvas.width = width;
    canvas.height = height;

    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve();
      };
      image.onerror = reject;
      image.src = dataUrl;
    });

    return canvas.toDataURL('image/png');
  }

  private drawContainedImage(doc: jsPDF, image: PreparedPdfImage, x: number, y: number, maxWidth: number, maxHeight: number): void {
    const ratio = image.width / image.height;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }

    this.addImage(doc, image, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
  }

  private addImage(doc: jsPDF, image: PreparedPdfImage, x: number, y: number, width: number, height: number): void {
    try {
      doc.addImage(image.dataUrl, image.format, x, y, width, height);
    } catch {
      // If jsPDF cannot decode the provided image, keep generating the document without blocking export.
    }
  }

  private withOpacity(doc: jsPDF, opacity: number, draw: () => void): void {
    const rawDoc = doc as any;
    if (!rawDoc.GState || !rawDoc.setGState) {
      draw();
      return;
    }

    try {
      rawDoc.setGState(new rawDoc.GState({ opacity }));
      draw();
      rawDoc.setGState(new rawDoc.GState({ opacity: 1 }));
    } catch {
      draw();
    }
  }

  private initials(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'E';
  }
}
