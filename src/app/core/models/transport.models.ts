export interface SaleTransportResponse {
    id: string;
    saleId: string;
    driverEmployeeId: string;
    driverFullName: string;
    vehicleId: string;
    vehiclePlate: string;
    status: number;
    statusName: string;
    assignedAt: string;
    dispatchedAt?: string | null;
    deliveredAt?: string | null;
    notes?: string | null;
    updatedAt?: string | null;
}

export interface CreateSaleTransportRequest {
    driverEmployeeId: string;
    vehicleId: string;
    notes?: string | null;
}
