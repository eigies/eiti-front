export interface EmployeeResponse {
    id: string;
    branchId?: string | null;
    firstName: string;
    lastName: string;
    fullName: string;
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    employeeRole: number;
    employeeRoleName: string;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CreateEmployeeRequest {
    branchId?: string | null;
    firstName: string;
    lastName: string;
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    employeeRole: number;
}

export interface DriverResponse {
    employeeId: string;
    fullName: string;
    isActive: boolean;
    licenseNumber: string;
    licenseCategory?: string | null;
    licenseExpiresAt?: string | null;
    isLicenseExpired: boolean;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt?: string | null;
}

export interface UpsertDriverProfileRequest {
    employeeId: string;
    licenseNumber: string;
    licenseCategory?: string | null;
    licenseExpiresAt?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    notes?: string | null;
}
