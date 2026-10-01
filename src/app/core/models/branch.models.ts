export interface BranchResponse {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    /** Override de la config de la empresa. Null = hereda. */
    automaticInvoicing?: boolean | null;
    /** Punto de venta de ARCA donde factura la sucursal. Null = todavia no puede facturar. */
    fiscalPointOfSaleNumber?: number | null;
    salesCount: number;
    cashValue: number;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CreateBranchRequest {
    name: string;
    code?: string | null;
    address?: string | null;
    /** Null = hereda la config de la empresa. */
    automaticInvoicing?: boolean | null;
}

/** Null quita el punto de venta de la sucursal. */
export interface SetBranchPointOfSaleRequest {
    number: number | null;
}

/** Como ARCA muestra el punto de venta en los comprobantes: 5 digitos (00003). */
export function formatPointOfSale(number: number): string {
    return String(number).padStart(5, '0');
}

export interface TransferTargetResponse {
    id: string;
    name: string;
}
