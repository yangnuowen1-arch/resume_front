import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export type JobCategoryStatus = "active" | "disabled";

export interface JobCategory {
  id: ApiId;
  name: string;
  description?: string;
  status: JobCategoryStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListJobCategoriesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: JobCategoryStatus;
}

export type ListJobCategoriesResponse = PaginatedResponse<JobCategory>;

export interface CreateJobCategoryRequest {
  name: string;
  description?: string;
  status?: JobCategoryStatus;
}

export interface UpdateJobCategoryRequest {
  name: string;
  status: JobCategoryStatus | string;
  description?: string;
}

export function listJobCategories(params: ListJobCategoriesParams = {}): Promise<ListJobCategoriesResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListJobCategoriesResponse>("/job-categories", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      status: params.status,
    },
  });
}

export function createJobCategory(payload: CreateJobCategoryRequest): Promise<void> {
  return request.post<void, CreateJobCategoryRequest>("/job-categories", payload);
}

export function updateJobCategory(id: ApiId, payload: UpdateJobCategoryRequest): Promise<void> {
  return request.put<void, UpdateJobCategoryRequest>(`/job-categories/${id}`, payload);
}
