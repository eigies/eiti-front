export interface BranchResponse {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    salesCount: number;
    cashValue: number;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CreateBranchRequest {
    name: string;
    code?: string | null;
    address?: string | null;
}
