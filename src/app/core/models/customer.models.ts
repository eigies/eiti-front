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
    email?: string | null;
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
    creditBalance: number;
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
    creditBalance: number;
}

export function toCustomerSearchItem(customer: CustomerResponse): CustomerSearchItem {
    return {
        id: customer.id,
        name: customer.name,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        documentType: customer.documentType,
        documentTypeName: customer.documentTypeName,
        documentNumber: customer.documentNumber,
        taxId: customer.taxId,
        creditBalance: customer.creditBalance
    };
}
