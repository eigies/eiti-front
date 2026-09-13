export interface BranchResponse {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    /** Override de la config de la empresa. Null = hereda. */
    automaticInvoicing?: boolean | null;
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

export interface TransferTargetResponse {
    id: string;
    name: string;
}
