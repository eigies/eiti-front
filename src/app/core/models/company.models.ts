export interface CompanyResponse {
    id: string;
    name: string;
    primaryDomain: string;
    createdAt: string;
}

export interface UpdateCompanyRequest {
    name: string;
    primaryDomain: string;
}
