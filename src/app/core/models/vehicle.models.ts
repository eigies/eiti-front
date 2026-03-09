export interface VehicleResponse {
    id: string;
    branchId?: string | null;
    assignedDriverEmployeeId?: string | null;
    assignedDriverFullName?: string | null;
    plate: string;
    model: string;
    brand?: string | null;
    year?: number | null;
    fuelType: number;
    fuelTypeName: string;
    currentOdometer?: number | null;
    lastFuelLoadedAt?: string | null;
    lastMaintenanceAt?: string | null;
    notes?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string | null;
}

export interface CreateVehicleRequest {
    branchId?: string | null;
    assignedDriverEmployeeId?: string | null;
    plate: string;
    model: string;
    brand?: string | null;
    year?: number | null;
    fuelType: number;
    currentOdometer?: number | null;
    notes?: string | null;
}

export interface FleetLogResponse {
    id: string;
    vehicleId: string;
    performedByEmployeeId?: string | null;
    performedByEmployeeName?: string | null;
    type: number;
    typeName: string;
    occurredAt: string;
    odometer?: number | null;
    fuelLiters?: number | null;
    fuelCost?: number | null;
    maintenanceType?: string | null;
    description: string;
    notes?: string | null;
    createdAt: string;
}

export interface CreateFleetLogRequest {
    performedByEmployeeId?: string | null;
    type: number;
    occurredAt: string;
    odometer?: number | null;
    fuelLiters?: number | null;
    fuelCost?: number | null;
    maintenanceType?: string | null;
    description: string;
    notes?: string | null;
}
