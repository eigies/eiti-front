export interface CompanyResponse {
    id: string;
    name: string;
    primaryDomain: string;
    isWhatsAppEnabled?: boolean | null;
    whatsAppSenderPhone?: string | null;
    whatsAppEnabled?: boolean | null;
    whatsAppPhoneNumber?: string | null;
    defaultNoDeliverySurcharge?: number | null;
    pdfLogoUrl?: string | null;
    pdfWatermarkUrl?: string | null;
    /** Facturar automaticamente cada venta al confirmarla. */
    automaticInvoicing?: boolean | null;
    /** Tope (0-100) del descuento general en ventas minoristas. 0 = descuento deshabilitado. */
    maxRetailDiscountPercent?: number | null;
    createdAt: string;
}

/** Se fija con su propio endpoint y permiso (sales.discount.configure), no con el PUT de la empresa. */
export interface SetRetailDiscountLimitRequest {
    maxPercent: number;
}

export interface UpdateCompanyRequest {
    name: string;
    primaryDomain: string;
    isWhatsAppEnabled?: boolean | null;
    whatsAppSenderPhone?: string | null;
    whatsAppEnabled?: boolean | null;
    whatsAppPhoneNumber?: string | null;
    defaultNoDeliverySurcharge?: number | null;
    pdfLogoUrl?: string | null;
    pdfWatermarkUrl?: string | null;
    automaticInvoicing?: boolean | null;
}
