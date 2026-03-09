export interface RoleDefinition {
    code: string;
    name: string;
    description: string;
    permissions: string[];
}

export interface UserResponse {
    id: string;
    username: string;
    email: string;
    isActive: boolean;
    employeeId?: string | null;
    employeeName?: string | null;
    roles: string[];
    permissions: string[];
    createdAt: string;
    lastLoginAt?: string | null;
}

export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    roleCodes: string[];
    employeeId?: string | null;
}

export interface UpdateUserRolesRequest {
    roleCodes: string[];
    employeeId?: string | null;
}

export interface UserRoleAuditResponse {
    id: string;
    targetUserId: string;
    targetUsername: string;
    changedByUserId?: string | null;
    changedByUsername?: string | null;
    previousRoles: string[];
    newRoles: string[];
    changedAt: string;
}
