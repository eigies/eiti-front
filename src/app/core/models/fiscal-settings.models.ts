/** Configuracion de facturacion electronica: datos del emisor y puntos de venta por sucursal. */
export interface FiscalSettingsResponse {
    /** False si la instalacion no tiene el servicio de facturacion configurado. */
    enabled: boolean;
    /** Default de la empresa: cada venta se factura al confirmarse. Cada sucursal puede sobrescribirlo. */
    automaticInvoicing: boolean;
    issuer: FiscalIssuerResponse | null;
    /** Por que no se pudieron leer los datos del emisor (ej. todavia no hay perfil fiscal). */
    issuerUnavailableReason: string | null;
    pointsOfSale: FiscalPointOfSaleResponse[];
}

export interface FiscalIssuerResponse {
    cuit: string;
    legalName: string;
    ivaCondition: number;
    iibb: string | null;
    /** yyyy-MM-dd */
    activityStartDate: string;
    commercialAddress: string | null;
    isProduction: boolean;
    certificateNotAfter: string | null;
}

export interface UpdateFiscalIssuerRequest {
    legalName: string;
    ivaCondition: number;
    iibb: string | null;
    activityStartDate: string;
    commercialAddress: string | null;
}

export interface FiscalPointOfSaleResponse {
    id: string;
    number: number;
    branchId: string | null;
    branchName: string | null;
}

export interface CreateFiscalPointOfSaleRequest {
    number: number;
    branchId: string | null;
}

/** Quien factura es Responsable Inscripto, Monotributista o Exento; nunca Consumidor Final. */
export const ISSUER_IVA_CONDITIONS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 1, label: 'Responsable Inscripto' },
    { value: 2, label: 'Monotributo' },
    { value: 4, label: 'Exento' }
];

/** 20397583857 -> 20-39758385-7 */
export function formatCuit(cuit: string): string {
    const digits = cuit.replace(/\D/g, '');
    return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : cuit;
}
