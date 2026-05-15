import { request } from "../request";

interface LoginRequest {
  account: string;
  password: string;
}

interface AuthUser {
  id: number;
  username: string;
  email: string;
  phone: string;
  realName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
}

interface LoginPayloadResponse {
  token: string;
  tokenType?: string;
  user?: AuthUser;
  roles?: string[];
}

export type LoginResponse = LoginPayloadResponse | string;

interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  realName: string;
  username: string;
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return request.post<LoginResponse, LoginRequest>("/auth/login", payload);
}

export function register(payload: RegisterRequest): Promise<string> {
  return request.post<string, RegisterRequest>("/auth/register", payload);
}
