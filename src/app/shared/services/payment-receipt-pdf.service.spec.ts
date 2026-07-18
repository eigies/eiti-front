import { PaymentReceiptData, PaymentReceiptPdfService } from './payment-receipt-pdf.service';
import { PdfBrandingService, PreparedPdfBranding } from './pdf-branding.service';

describe('PaymentReceiptPdfService', () => {
  const branding: PreparedPdfBranding = {
    companyName: 'EITI',
    logo: null,
    watermark: null,
    eitiIcon: null
  };

  let service: PaymentReceiptPdfService;
  let brandingService: jasmine.SpyObj<PdfBrandingService>;
  let textSpy: jasmine.Spy;

  beforeEach(() => {
    brandingService = jasmine.createSpyObj<PdfBrandingService>('PdfBrandingService', [
      'prepare',
      'drawWatermark',
      'drawHeader',
      'drawFooter'
    ]);
    brandingService.prepare.and.resolveTo(branding);
    brandingService.drawHeader.and.returnValue(36);
    service = new PaymentReceiptPdfService(brandingService);
    textSpy = jasmine.createSpy('text');
  });

  it('prints the sale detail when the receipt belongs to a sale payment', async () => {
    const data: PaymentReceiptData = {
      kind: 'cobro',
      partyLabel: 'Cliente',
      partyName: 'Juan Pablo Del Pin',
      amount: 200000,
      date: '2026-07-17T10:39:00',
      methodLabel: 'Cash',
      coverage: [{ code: 'SUCU-123-129', amount: 200000 }],
      saleDetailSections: [{
        code: 'SUCU-123-129',
        details: [{
          productBrand: 'Moura',
          productName: 'Bateria God',
          quantity: 1,
          unitPrice: 200000,
          totalAmount: 200000
        }]
      }]
    };

    const doc = {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297
        }
      },
      setFont: jasmine.createSpy('setFont'),
      setFontSize: jasmine.createSpy('setFontSize'),
      setTextColor: jasmine.createSpy('setTextColor'),
      setFillColor: jasmine.createSpy('setFillColor'),
      setDrawColor: jasmine.createSpy('setDrawColor'),
      roundedRect: jasmine.createSpy('roundedRect'),
      rect: jasmine.createSpy('rect'),
      line: jasmine.createSpy('line'),
      text: textSpy
    };

    (service as any).drawReceiptPage(doc, branding, data);

    const writtenText = textSpy.calls.allArgs().flat().filter((arg): arg is string => typeof arg === 'string');
    expect(writtenText).toContain('Detalle de venta');
    expect(writtenText).toContain('SUCU-123-129');
    expect(writtenText).toContain('Moura / Bateria God');
  });
});
