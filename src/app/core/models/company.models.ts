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
    createdAt: string;
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
}
