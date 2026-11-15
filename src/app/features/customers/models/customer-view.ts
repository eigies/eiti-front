import { CustomerResponse } from '../../../core/models/customer.models';

/** Funciones de presentación del listado de clientes (movidas tal cual desde CustomersComponent). */
export function customerInitial(customer: CustomerResponse): string {
  const source = customer.name || customer.fullName || customer.email || '?';
  return source.charAt(0).toUpperCase();
}

export function formatDocument(customer: CustomerResponse): string {
  const documentNumber = customer.documentNumber?.trim();
  const taxId = customer.taxId?.trim();
  const documentLabel = customer.documentTypeName || 'Doc.';
  const parts = [
    documentNumber ? `${documentLabel} ${documentNumber}` : null,
    taxId ? `CUIT ${taxId}` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Sin documento';
}

export function formatAddress(customer: CustomerResponse): string {
  const address = customer.address;
  if (!address) {
    return 'Sin dirección';
  }

  const street = [address.street, address.streetNumber].filter(Boolean).join(' ').trim();
  const locality = [address.city, address.stateOrProvince].filter(Boolean).join(', ').trim();
  const postal = address.postalCode ? `CP ${address.postalCode}` : '';
  const country = address.country || '';
  return [street, locality, postal, country].filter(Boolean).join(' - ');
}
