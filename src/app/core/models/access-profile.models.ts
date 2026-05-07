export interface AccessProfileResponse {
    id: string;
    name: string;
    description: string | null;
    permissionCodes: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAccessProfileRequest {
    name: string;
    description: string | null;
    permissionCodes: string[];
}

export interface UpdateAccessProfileRequest {
    name: string;
    description: string | null;
    permissionCodes: string[];
}
