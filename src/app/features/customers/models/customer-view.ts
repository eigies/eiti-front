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

const AVATAR_TONES = ['teal', 'indigo', 'orange', 'purple', 'cyan', 'pink', 'lime'] as const;
export type AvatarTone = typeof AVATAR_TONES[number];

/** Color estable de la inicial: siempre el mismo para el mismo cliente. */
export function avatarTone(customer: CustomerResponse): AvatarTone {
  const key = customer.id || customer.name || '';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
