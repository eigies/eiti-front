import { SalePaymentRequest, SalePaymentResponse, SaleTradeInRequest, SaleTradeInResponse } from './sale-payment.models';

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
