import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export type TagGroupStatus = "active" | "disabled";

export interface TagGroup {
  id: ApiId;
  name: string;
  description?: string;
  sortOrder?: number;
  status: TagGroupStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListTagGroupsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: TagGroupStatus | string;
}

export type ListTagGroupsResponse = PaginatedResponse<TagGroup>;

export interface CreateTagGroupRequest {
  name: string;
  description?: string;
  sortOrder?: number;
}

export function listTagGroups(params: ListTagGroupsParams = {}): Promise<ListTagGroupsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListTagGroupsResponse>("/tag-groups", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      status: params.status,
    },
  });
}

export function createTagGroup(payload: CreateTagGroupRequest): Promise<void> {
  return request.post<void, CreateTagGroupRequest>("/tag-groups", payload);
}
