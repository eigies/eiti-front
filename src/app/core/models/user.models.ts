export interface UserResponse {
    id: string;
    username: string;
    email: string;
    isActive: boolean;
    employeeId?: string | null;
    employeeName?: string | null;
    profileId: string | null;
    profileName: string | null;
    permissions: string[];
    createdAt: string;
    lastLoginAt?: string | null;
    roles?: string[];
}

export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    profileId: string;
    employeeId?: string | null;
}

export interface UpdateUserProfileRequest {
    profileId: string;
    employeeId?: string | null;
}

export interface UserProfileAuditResponse {
    id: string;
    targetUserId: string;
    targetUsername: string;
    changedByUserId?: string | null;
    changedByUsername?: string | null;
    previousProfileId?: string | null;
    previousProfileName?: string | null;
    newProfileId?: string | null;
    newProfileName?: string | null;
    previousPermissionCodes?: string[];
    newPermissionCodes?: string[];
    changedAt: string;
}
