import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export type TagStatus = "active" | "disabled";

export interface Tag {
  id: ApiId;
  tagId?: ApiId;
  jobId?: ApiId;
  name: string;
  groupId?: number;
  groupName?: string;
  color?: string;
  status: TagStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListTagsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupId?: number;
  status?: TagStatus | string;
}

export type ListTagsResponse = PaginatedResponse<Tag>;

export interface CreateTagRequest {
  name: string;
  status?: TagStatus | string;
  color?: string;
  groupId?: number;
}

export interface UpdateTagRequest {
  name: string;
  status: TagStatus | string;
  color?: string;
  groupId?: number;
}

export function listTags(params: ListTagsParams = {}): Promise<ListTagsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListTagsResponse>("/tags", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      groupId: params.groupId,
      status: params.status,
    },
  });
}

export function createTag(payload: CreateTagRequest): Promise<void> {
  return request.post<void, CreateTagRequest>("/tags", payload);
}

export function updateTag(id: ApiId, payload: UpdateTagRequest): Promise<void> {
  return request.put<void, UpdateTagRequest>(`/tags/${id}`, payload);
}
