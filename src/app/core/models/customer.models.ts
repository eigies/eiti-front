export interface AddressRequest {
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    stateOrProvince: string;
    country: string;
    floor?: string | null;
    apartment?: string | null;
    reference?: string | null;
}

export interface AddressResponse {
    id: string;
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    stateOrProvince: string;
    country: string;
    floor?: string | null;
    apartment?: string | null;
    reference?: string | null;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CreateCustomerRequest {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    documentType?: number | null;
    documentNumber?: string | null;
    taxId?: string | null;
    address?: AddressRequest | null;
}

export interface UpdateCustomerRequest extends CreateCustomerRequest {
    id: string;
}

export interface CustomerResponse {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    documentType?: number | null;
    documentTypeName?: string | null;
    documentNumber?: string | null;
    taxId?: string | null;
    addressId?: string | null;
    address?: AddressResponse | null;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CustomerSearchItem {
    id: string;
    name: string;
    fullName: string;
    email: string;
    phone: string;
    documentType?: number | null;
    documentTypeName?: string | null;
    documentNumber?: string | null;
    taxId?: string | null;
}
