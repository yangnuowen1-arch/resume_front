import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export type UserStatus = "active" | "disabled";

export interface Role {
  id?: ApiId;
  code?: string;
  name?: string;
  description?: string;
  status?: string;
}

export type RoleOption = Role | string;

export interface User {
  id: ApiId;
  username: string;
  realName?: string;
  email?: string;
  phone?: string;
  status: UserStatus | string;
  roles?: RoleOption[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: UserStatus | string;
}

export type ListUsersResponse = PaginatedResponse<User>;

export interface CreateUserRequest {
  username: string;
  password: string;
  realName?: string;
  email?: string;
  phone?: string;
  status?: UserStatus | string;
  roles?: string[];
}

export interface UpdateUserRequest {
  username: string;
  status: UserStatus | string;
  realName?: string;
  email?: string;
  phone?: string;
}

export interface AssignUserRolesRequest {
  roles: string[];
}

export function listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListUsersResponse>("/users", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      status: params.status,
    },
  });
}

export function createUser(payload: CreateUserRequest): Promise<void> {
  return request.post<void, CreateUserRequest>("/users", payload);
}

export function updateUser(id: ApiId, payload: UpdateUserRequest): Promise<void> {
  return request.put<void, UpdateUserRequest>(`/users/${id}`, payload);
}

export function assignUserRoles(id: ApiId, payload: AssignUserRolesRequest): Promise<void> {
  return request.put<void, AssignUserRolesRequest>(`/users/${id}/roles`, payload);
}

export async function listRoles(): Promise<RoleOption[]> {
  const response = await request.get<RoleOption[] | { items?: RoleOption[]; roles?: RoleOption[] }>("/roles");
  return Array.isArray(response) ? response : response.items ?? response.roles ?? [];
}
