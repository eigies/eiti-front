export interface UserResponse {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    isActive: boolean;
    employeeId?: string | null;
    employeeName?: string | null;
    profileId: string | null;
    profileName: string | null;
    permissions: string[];
    branchIds: string[];
    createdAt: string;
    lastLoginAt?: string | null;
}

export interface CreateUserRequest {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    profileId: string;
    employeeId?: string | null;
    isEmployee?: boolean;
    branchIds?: string[];
}

export interface UpdateUserProfileRequest {
    firstName: string;
    lastName: string;
    profileId: string;
    employeeId?: string | null;
    isEmployee?: boolean;
    branchIds?: string[];
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
