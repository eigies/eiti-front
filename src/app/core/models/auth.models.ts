// Auth Models
export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    companyName: string;
}

export interface LoginRequest {
    usernameOrEmail: string;
    password: string;
}

export interface AuthResponse {
    userId: string;
    username: string;
    email: string;
    token: string;
    roles: string[];
    permissions: string[];
}
