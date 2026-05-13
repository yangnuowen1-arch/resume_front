import { request } from "../request";

interface LoginRequest {
  account: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  realName: string;
  username: string;
}

export function login(payload: LoginRequest): Promise<string> {
  return request.post<string, LoginRequest>("/auth/login", payload);
}

export function register(payload: RegisterRequest): Promise<string> {
  return request.post<string, RegisterRequest>("/auth/register", payload);
}
