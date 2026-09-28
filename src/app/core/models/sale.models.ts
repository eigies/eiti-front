import { SalePaymentRequest, SalePaymentResponse, SaleTradeInRequest, SaleTradeInResponse } from './sale-payment.models';

export type SaleSourceChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const SALE_SOURCE_CHANNELS: { value: SaleSourceChannel; label: string; icon: string; assetPath: string }[] = [
    { value: 1,  label: 'Referido',         icon: '👥', assetPath: 'ch-referido.svg'      },
    { value: 2,  label: 'WhatsApp',         icon: '📱', assetPath: 'ch-whatsapp.svg'      },
    { value: 3,  label: 'Facebook',         icon: '📘', assetPath: 'ch-facebook.svg'      },
    { value: 4,  label: 'Web',              icon: '🌐', assetPath: 'ch-web.svg'           },
    { value: 5,  label: 'Instagram',        icon: '📷', assetPath: 'ch-instagram.svg'     },
    { value: 6,  label: 'Llamada',          icon: '📞', assetPath: 'ch-llamada.svg'       },
    { value: 7,  label: 'Cliente anterior', icon: '🔄', assetPath: 'ch-cliente-ant.svg'   },
    { value: 8,  label: 'Mercado Libre',    icon: '🛒', assetPath: 'ch-mercadolibre.svg'  },
    { value: 9,  label: 'Google',           icon: '🔍', assetPath: 'ch-google.svg'        },
    { value: 10, label: 'Sin canal',        icon: '—',  assetPath: 'ch-phone-off.png'    },
    { value: 11, label: 'No contesta',      icon: '🚫', assetPath: 'ch-no-contesta.svg'  },
];

export function saleSourceChannelLabel(channel: SaleSourceChannel | null | undefined): string {
    const found = SALE_SOURCE_CHANNELS.find(c => c.value === channel);
    return found ? `${found.icon} ${found.label}` : '';
}

export type SaleInvoicingStatus = 1 | 2 | 3 | 4 | 5;

export const SALE_INVOICING_STATUS = {
    notInvoiced: 1 as SaleInvoicingStatus,
    inProgress: 2 as SaleInvoicingStatus,
    invoiced: 3 as SaleInvoicingStatus,
    rejected: 4 as SaleInvoicingStatus,
    /** Anulada por una nota de credito. Su comprobante existio y se puede reimprimir. */
    voided: 5 as SaleInvoicingStatus
};

export function saleInvoicingStatusLabel(status: SaleInvoicingStatus | null | undefined): string {
    switch (status) {
        case 2: return 'En tramite';
        case 3: return 'Facturado';
        case 4: return 'Rechazado';
        case 5: return 'Anulada';
        default: return 'Sin facturar';
    }
}

/** Datos del cliente que pide ARCA para facturar; mismos criterios que SaleInvoicingReceiverRules del back. */
export interface InvoicingCustomer {
    fullName?: string | null;
    name?: string | null;
    taxId?: string | null;
    ivaCondition?: number | null;
}

const IVA_CONDITION_REGISTERED = 1;
const IVA_CONDITION_MONOTRIBUTE = 2;
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** 11 digitos con digito verificador modulo 11, el mismo calculo que hace ARCA. */
export function isValidCuit(value: string | null | undefined): boolean {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length !== 11) {
        return false;
    }
    const sum = CUIT_WEIGHTS.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
    const raw = 11 - (sum % 11);
    const expected = raw === 11 ? 0 : raw === 10 ? 9 : raw;
    return Number(digits[10]) === expected;
}

/** Letra que elige el vendedor. Mismos valores que InvoiceLetter del back. */
export enum InvoiceLetter {
    A = 1,
    B = 2
}

/** Letra que le corresponde al cliente: A si es Responsable Inscripto o Monotributista, B para el resto. */
export function suggestedInvoiceLetter(customer: InvoicingCustomer | null | undefined): InvoiceLetter {
    const condition = customer?.ivaCondition;
    return condition === IVA_CONDITION_REGISTERED || condition === IVA_CONDITION_MONOTRIBUTE
        ? InvoiceLetter.A
        : InvoiceLetter.B;
}

/**
 * Null si se puede facturar al cliente; si no, que dato falta. Mismos criterios que
 * SaleInvoicingReceiverRules del back. Sin cliente es Consumidor Final: se factura B siempre
 * (el tope de ARCA para consumidor final lo valida el servicio de facturacion). Con letra, ademas
 * exige que sea la que le corresponde al cliente: ARCA rechaza A a un consumidor final y B a un
 * Responsable Inscripto.
 */
export function invoicingCustomerIssue(customer: InvoicingCustomer | null | undefined, letter?: InvoiceLetter | null): string | null {
    const suggested = suggestedInvoiceLetter(customer);
    const name = customer?.fullName || customer?.name || 'el cliente';

    if (letter === InvoiceLetter.A && suggested !== InvoiceLetter.A) {
        return customer
            ? `${name} no está cargado como Responsable Inscripto ni Monotributista: le corresponde Factura B. Para hacer Factura A actualizá su condición frente al IVA.`
            : 'Para hacer Factura A elegí el cliente o dalo de alta con su CUIT y su condición frente al IVA.';
    }
    if (!customer || suggested !== InvoiceLetter.A) {
        return null;
    }

    const label = customer.ivaCondition === IVA_CONDITION_REGISTERED ? 'Responsable Inscripto' : 'Monotributista';
    if (letter === InvoiceLetter.B) {
        return `${name} es ${label}: le corresponde Factura A.`;
    }
    if (!(customer.taxId ?? '').replace(/\D/g, '')) {
        return `Para facturar a ${name} (${label}) hay que cargar su CUIT en la ficha del cliente.`;
    }
    return isValidCuit(customer.taxId) ? null : `El CUIT de ${name} no es válido. Revisalo en la ficha del cliente.`;
}

/** "invoiceA" -> "Factura A". El tipo viene del servicio de facturacion en camelCase. */
export function fiscalDocumentLabel(documentType: string | null | undefined): string {
    const letter = (documentType ?? '').slice(-1).toUpperCase();
    const kind = (documentType ?? '').startsWith('creditNote') ? 'Nota de credito' : 'Factura';
    return letter === 'A' || letter === 'B' || letter === 'C' ? `${kind} ${letter}` : kind;
}

/** Numero de comprobante con el formato de AFIP: 00003-00001045. */
export function fiscalNumberLabel(pointOfSale: number | null | undefined, number: number | null | undefined): string {
    if (pointOfSale === null || pointOfSale === undefined || number === null || number === undefined) {
        return '';
    }
    return `${String(pointOfSale).padStart(5, '0')}-${String(number).padStart(8, '0')}`;
}

/**
 * Datos para imprimir la factura o la nota de credito con el diseno de EITI.
 * Comprobante, emisor, receptor, importes y asociado son los que autorizo ARCA;
 * items, ajustes, domicilio y condicion de venta salen de la venta.
 * Los precios de los items vienen CON IVA incluido, como se vendieron.
 */
export interface SaleInvoicePrintResponse {
    kind: 'invoice' | 'creditNote';
    letter: 'A' | 'B';
    typeCode: number;
    title: string;
    pointOfSale: number;
    number: number;
    date: string;
    authorizationCode: string;
    authorizationExpiry: string;
    qrUrl: string;
    isVoided: boolean;
    issuer: SaleInvoicePrintIssuer;
    receiver: SaleInvoicePrintReceiver;
    associatedDocument?: SaleInvoicePrintAssociatedDocument | null;
    saleCode: string;
    saleCondition: string;
    vatRate: number;
    items: SaleInvoicePrintItem[];
    adjustments: SaleInvoicePrintAdjustments;
    amounts: SaleInvoicePrintAmounts;
}

export interface SaleInvoicePrintIssuer {
    legalName: string;
    cuit: string;
    vatCondition: string;
    iibb?: string | null;
    activityStartDate: string;
    commercialAddress?: string | null;
    branchName?: string | null;
}

export interface SaleInvoicePrintReceiver {
    name: string;
    vatCondition: string;
    identification?: string | null;
}

export interface SaleInvoicePrintAssociatedDocument {
    label: string;
    pointOfSale: number;
    number: number;
    date: string;
}

export interface SaleInvoicePrintItem {
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    total: number;
}

export interface SaleInvoicePrintAdjustments {
    itemsSubtotal: number;
    noDeliverySurcharge: number;
    generalDiscountPercent: number;
    agreedPrice?: number | null;
}

export interface SaleInvoicePrintAmounts {
    net: number;
    vat: { rate: number; base: number; amount: number }[];
    exempt: number;
    total: number;
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
    deliveryAddress?: string | null;
    contactPhone?: string | null;
    /** Opt-in por venta. Se ignora si la empresa/sucursal factura automaticamente. */
    requestInvoicing?: boolean;
    /** Letra elegida por el vendedor; el back frena la venta si no coincide con el cliente. */
    invoiceLetter?: InvoiceLetter | null;
}

export interface CreateSaleDetailRequest {
    productId: string;
    quantity: number;
    unitPrice?: number;
    discountPercent?: number;
}

/** Como termino el pedido de factura hecho al crear la venta. */
export interface CreateSaleInvoicingResult {
    status: SaleInvoicingStatus;
    statusName: string;
    documentType?: string | null;
    pointOfSale?: number | null;
    number?: number | null;
    message?: string | null;
}

export interface SaleResponse {
    id: string;
    code?: string | null;
    branchId: string;
    customerId?: string | null;
    customerFullName?: string | null;
    customerDocument?: string | null;
    customerTaxId?: string | null;
    customerAddress?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    contactPhone?: string | null;
    cashDrawerId?: string | null;
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
    isCuentaCorriente: boolean;
    changeAmount?: number;
    noDeliverySurchargeTotal?: number | null;
    sourceChannel?: SaleSourceChannel | null;
    invoicingStatus?: SaleInvoicingStatus | null;
    fiscalNumber?: number | null;
    fiscalPointOfSale?: number | null;
    /** "invoiceA" / "invoiceB": de aca sale la letra que muestra el listado. */
    fiscalDocumentType?: string | null;
    generalDiscountPercent?: number;
    originalTotal?: number;
    manualOverridePrice?: number | null;
    overriddenByUserId?: string | null;
    overriddenAt?: string | null;
    payments?: SalePaymentResponse[];
    tradeIns?: SaleTradeInResponse[];
    details: SaleDetailResponse[];
}

/** Aviso final al crear una venta: si se facturo, dice como termino. Igual en mostrador y CC. */
export interface SaleCreatedNotice {
    message: string;
    type: 'success' | 'error' | 'info';
    duration: number;
}

export function saleCreatedNotice(saleLabel: string, invoicing: CreateSaleInvoicingResult | null | undefined): SaleCreatedNotice {
    if (!invoicing) {
        return { message: saleLabel, type: 'success', duration: 4000 };
    }
    switch (invoicing.status) {
        case 3: {
            const number = fiscalNumberLabel(invoicing.pointOfSale, invoicing.number);
            return { message: `${saleLabel} · ${fiscalDocumentLabel(invoicing.documentType)}${number ? ' ' + number : ''}`, type: 'success', duration: 5000 };
        }
        case 4:
            return { message: `${saleLabel} · la factura fue rechazada: ${invoicing.message || 'sin motivo informado'}`, type: 'error', duration: 9000 };
        default:
            return { message: `${saleLabel} · la factura quedó en trámite y se completa sola`, type: 'info', duration: 6000 };
    }
}

/** Respuesta del alta: la venta mas como termino la factura, si se facturo. */
export interface CreateSaleResponse extends SaleResponse {
    invoicing?: CreateSaleInvoicingResult | null;
}

export interface SaleDetailResponse {
    productId: string;
    productName: string;
    productBrand: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    discountPercent: number;
}

export interface SendSaleWhatsAppResponse {
    saleId: string;
    toPhone: string;
    message: string;
    launchUrl: string;
    requiresUserAction: boolean;
}

export interface CreateCcSaleRequest {
    branchId: string;
    customerId: string;
    details: CreateSaleDetailRequest[];
    tradeIns?: SaleTradeInRequest[];
    generalDiscountPercent?: number;
    manualOverridePrice?: number | null;
    /** Igual que en mostrador: pedido explicito de factura y la letra elegida. */
    requestInvoicing?: boolean;
    invoiceLetter?: InvoiceLetter | null;
}

export interface SaleTradeInDetail {
    productId: string;
    productName: string;
    productBrand: string;
    quantity: number;
    amount: number;
}

export interface CcPaymentResponse {
    id: string;
    saleId: string;
    idPaymentMethod: number;
    paymentMethodName: string;
    amount: number;
    date: string;
    notes?: string | null;
    status: number;
    statusName: string;
    createdAt: string;
    cancelledAt?: string | null;
    groupId?: string | null;
}

export interface AddCcPaymentRequest {
    idPaymentMethod: number;
    amount: number;
    date: string;
    notes?: string | null;
}

export interface CcSaleListItem {
    id: string;
    code: string | null;
    customerFullName: string | null;
    createdAt: string;
    totalAmount: number;
    ccPaidTotal: number;
    ccPendingAmount: number;
    idSaleStatus: number;
    saleStatus: string;
    isCuentaCorriente: boolean;
}

export interface CcPaymentMethodLineRequest {
    idPaymentMethod: number;
    amount: number;
    cardBankId?: number | null;
    cardCuotas?: number | null;
    cheque?: {
        numero: string;
        bankId: number;
        titular: string;
        cuitDni: string;
        monto: number;
        fechaEmision: string;
        fechaVencimiento: string;
        notas?: string | null;
    } | null;
}

export interface AddCcPaymentGroupRequest {
    methods: CcPaymentMethodLineRequest[];
    date: string;
    notes?: string | null;
    cashDrawerId: string;
}

export interface AddCcPaymentGroupResponse {
    payments: CcPaymentResponse[];
    creditAdded?: number;
    newCustomerCreditBalance?: number;
}

export interface CreateCcSaleResponse {
    id: string;
    code?: string | null;
    /** Como termino la factura, si se facturo al crear la venta. */
    invoicing?: CreateSaleInvoicingResult | null;
    creditApplied?: number;
    remainingCustomerCredit?: number;
    tradeInAmount?: number;
    ccPendingAmount?: number;
    tradeIns?: SaleTradeInDetail[];
}

export interface InvoiceSaleResponse {
    saleId: string;
    invoicingStatus: SaleInvoicingStatus;
    invoicingStatusName: string;
    fiscalDocumentId?: string | null;
    fiscalDocumentType?: string | null;
    pointOfSale?: number | null;
    number?: number | null;
    cae?: string | null;
    caeExpiry?: string | null;
    qrUrl?: string | null;
    message?: string | null;
}

export interface SaleByIdResponse {
    id: string;
    code?: string | null;
    branchId: string;
    customerId?: string | null;
    customerFullName?: string | null;
    customerDocument?: string | null;
    customerTaxId?: string | null;
    cashDrawerId?: string | null;
    hasDelivery: boolean;
    idSaleStatus: number;
    saleStatus: string;
    isCuentaCorriente: boolean;
    totalAmount: number;
    monetaryPaidAmount: number;
    tradeInAmount: number;
    settledAmount: number;
    pendingAmount: number;
    ccPaidTotal: number;
    ccPendingAmount: number;
    generalDiscountPercent?: number;
    originalTotal?: number;
    manualOverridePrice?: number | null;
    overriddenByUserId?: string | null;
    overriddenAt?: string | null;
    createdAt: string;
    paidAt?: string | null;
    updatedAt?: string | null;
    invoicingStatus: SaleInvoicingStatus;
    invoicingStatusName: string;
    fiscalDocumentId?: string | null;
    fiscalDocumentType?: string | null;
    fiscalPointOfSale?: number | null;
    fiscalNumber?: number | null;
    cae?: string | null;
    caeExpiry?: string | null;
    fiscalQrUrl?: string | null;
    fiscalRejectionReason?: string | null;
    invoicedAt?: string | null;
    creditNoteStatus?: SaleInvoicingStatus | null;
    creditNoteNumber?: number | null;
    details: SaleDetailResponse[];
    payments: { idPaymentMethod: number; paymentMethod: string; amount: number; reference?: string | null }[];
    ccPayments: CcPaymentResponse[];
    tradeIns: SaleTradeInDetail[];
}
