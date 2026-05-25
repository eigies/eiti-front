export interface SupplierListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  isActive: boolean;
}

export interface CreateSupplierRequest {
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  notes: string | null;
}

export interface UpdateSupplierRequest extends CreateSupplierRequest {
  id: string;
}
