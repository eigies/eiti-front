// src/app/core/models/quote.models.ts
import { CreateSaleDetailRequest, CreateCcSaleResponse } from './sale.models';
import { SaleTradeInRequest } from './sale-payment.models';

export type QuoteStatusCode = 1 | 2 | 3; // Pending | Converted | Cancelled

export interface QuoteDetailItem {
    productId: string;
    productName: string;
    productBrand: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    lineTotal: number;
}

export interface QuoteListItem {
    id: string;
    code?: string | null;
    branchId: string;
    customerId?: string | null;
    customerFullName?: string | null;
    prospectName?: string | null;
    totalAmount: number;
    expiresAt: string;
    idQuoteStatus: QuoteStatusCode;
    status: string;
    isExpired: boolean;
    convertedSaleId?: string | null;
    createdAt: string;
}

export interface QuoteDetailResponse {
    id: string;
    code?: string | null;
    branchId: string;
    branchName: string;
    customerId?: string | null;
    customerFullName?: string | null;
    prospectName?: string | null;
    prospectContact?: string | null;
    generalDiscountPercent: number;
    totalAmount: number;
    expiresAt: string;
    idQuoteStatus: QuoteStatusCode;
    status: string;
    isExpired: boolean;
    convertedSaleId?: string | null;
    createdAt: string;
    details: QuoteDetailItem[];
}

export interface CreateQuoteDetailRequest {
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
}

export interface CreateQuoteRequest {
    branchId: string;
    customerId?: string | null;
    prospectName?: string | null;
    prospectContact?: string | null;
    details: CreateQuoteDetailRequest[];
    generalDiscountPercent: number;
    expiresAt: string;
}

export interface ConvertQuoteRequest {
    branchId: string;
    customerId: string;
    details: CreateSaleDetailRequest[];
    tradeIns?: SaleTradeInRequest[];
    generalDiscountPercent?: number;
    manualOverridePrice?: number | null;
}

export type ConvertQuoteResponse = CreateCcSaleResponse;

export interface CreateQuoteResponse {
    id: string;
    code?: string | null;
    branchId: string;
    customerId?: string | null;
    customerFullName?: string | null;
    prospectName?: string | null;
    prospectContact?: string | null;
    generalDiscountPercent: number;
    totalAmount: number;
    expiresAt: string;
    idQuoteStatus: QuoteStatusCode;
    status: string;
    createdAt: string;
    details: QuoteDetailItem[];
}

export interface ListQuotesFilters {
    idQuoteStatus?: QuoteStatusCode;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
}
