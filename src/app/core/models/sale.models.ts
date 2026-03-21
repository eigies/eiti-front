import { SalePaymentRequest, SalePaymentResponse, SaleTradeInRequest, SaleTradeInResponse } from './sale-payment.models';

export type SaleSourceChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const SALE_SOURCE_CHANNELS: { value: SaleSourceChannel; label: string; icon: string; assetPath: string }[] = [
    { value: 1, label: 'Referido',         icon: '👥', assetPath: 'ch-referido.svg'      },
    { value: 2, label: 'WhatsApp',         icon: '📱', assetPath: 'ch-whatsapp.svg'      },
    { value: 3, label: 'Facebook',         icon: '📘', assetPath: 'ch-facebook.svg'      },
    { value: 4, label: 'Web',              icon: '🌐', assetPath: 'ch-web.svg'           },
    { value: 5, label: 'Instagram',        icon: '📷', assetPath: 'ch-instagram.svg'     },
    { value: 6, label: 'Llamada',          icon: '📞', assetPath: 'ch-llamada.svg'       },
    { value: 7, label: 'Cliente anterior', icon: '🔄', assetPath: 'ch-cliente-ant.svg'   },
    { value: 8, label: 'Mercado Libre',    icon: '🛒', assetPath: 'ch-mercadolibre.svg'  },
    { value: 9, label: 'Google',           icon: '🔍', assetPath: 'ch-google.svg'        },
];

export function saleSourceChannelLabel(channel: SaleSourceChannel | null | undefined): string {
    const found = SALE_SOURCE_CHANNELS.find(c => c.value === channel);
    return found ? `${found.icon} ${found.label}` : '';
}

export interface CreateSaleRequest {
    branchId: string;
    customerId?: string | null;
    idSaleStatus: number;
    hasDelivery: boolean;
    cashDrawerId?: string | null;
    payments: SalePaymentRequest[];
    tradeIns: SaleTradeInRequest[];
    details: CreateSaleDetailRequest[];
    noDeliverySurchargeTotal?: number | null;
    sourceChannel?: SaleSourceChannel | null;
}

export interface CreateSaleDetailRequest {
    productId: string;
    quantity: number;
    unitPrice?: number;
}

export interface SaleResponse {
    id: string;
    branchId: string;
    customerId?: string | null;
    customerFullName?: string | null;
    customerDocument?: string | null;
    customerTaxId?: string | null;
    customerAddress?: string | null;
    cashSessionId?: string | null;
    hasDelivery: boolean;
    transportAssignmentId?: string | null;
    driverFullName?: string | null;
    vehiclePlate?: string | null;
    transportStatus?: number | null;
    transportStatusName?: string | null;
    idSaleStatus: number;
    saleStatus: string;
    totalAmount: number;
    monetaryPaidAmount?: number;
    tradeInAmount?: number;
    settledAmount?: number;
    pendingAmount?: number;
    createdAt: string;
    paidAt?: string | null;
    updatedAt?: string | null;
    isModified: boolean;
    changeAmount?: number;
    noDeliverySurchargeTotal?: number | null;
    sourceChannel?: SaleSourceChannel | null;
    payments?: SalePaymentResponse[];
    tradeIns?: SaleTradeInResponse[];
    details: SaleDetailResponse[];
}

export interface SaleDetailResponse {
    productId: string;
    productName: string;
    productBrand: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
}

export interface SendSaleWhatsAppResponse {
    saleId: string;
    toPhone: string;
    message: string;
    launchUrl: string;
    requiresUserAction: boolean;
}
