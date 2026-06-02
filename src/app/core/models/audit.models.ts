export interface AuditLogItem {
    id: string;
    userId: string | null;
    userName: string | null;
    actionType: string;
    succeeded: boolean;
    errorCode: string | null;
    payloadJson: string | null;
    timestamp: string;
}

export interface AuditLogPagedResponse {
    items: AuditLogItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface AuditLogFilters {
    dateFrom: string;
    dateTo: string;
    userId?: string | null;
    page?: number;
    pageSize?: number;
}
