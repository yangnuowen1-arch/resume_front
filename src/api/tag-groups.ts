import { request } from "../request";
import type { Tag, TagStatus } from "./tags";
import type { ApiId, PaginatedResponse } from "./types";

export type TagGroupStatus = "active" | "disabled";

export interface TagGroup {
  id: ApiId;
  name: string;
  description?: string;
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
  status?: TagGroupStatus | string;
}

export interface UpdateTagGroupRequest {
  name: string;
  status: TagGroupStatus | string;
  description?: string;
}

export interface GroupedTagGroup extends TagGroup {
  tags?: Array<Tag & { status?: TagStatus | string }>;
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

export function updateTagGroup(id: ApiId, payload: UpdateTagGroupRequest): Promise<void> {
  return request.put<void, UpdateTagGroupRequest>(`/tag-groups/${id}`, payload);
}

export async function listGroupedTags(params: { status?: TagStatus | string } = {}): Promise<GroupedTagGroup[]> {
  const response = await request.get<GroupedTagGroup[] | { groups?: GroupedTagGroup[]; items?: GroupedTagGroup[] }>("/tags/grouped", {
    params: {
      status: params.status,
    },
  });

  return Array.isArray(response) ? response : response.items ?? response.groups ?? [];
}
