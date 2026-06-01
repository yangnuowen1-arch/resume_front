import { request } from "../request";
import type { Tag } from "./tags";
import { normalizePaginatedResponse, type ApiId, type ApiPaginatedResponse, type PaginatedResponse } from "./types";

export type JobStatus = "draft" | "published" | "closed";
export type JobDynamicFieldValue = string | number | boolean | null | JobDynamicFieldValue[] | { [key: string]: JobDynamicFieldValue };
export type JobDynamicFields = Record<string, JobDynamicFieldValue>;

export interface Job {
  id: ApiId;
  title: string;
  categoryId?: number | null;
  categoryName?: string;
  department?: string;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  bonusPoints?: string;
  workLocation?: string;
  workType?: string;
  employmentType?: string;
  educationLevel?: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryMonths?: number | null;
  headcount?: number | null;
  ownerUserId?: number | null;
  ownerName?: string;
  priority?: string;
  status: JobStatus | string;
  dynamicFields?: JobDynamicFields;
  tags?: Tag[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number | null;
  status?: JobStatus | string;
}

export type ListJobsResponse = PaginatedResponse<Job>;

export interface JobMutationResponse {
  id: ApiId;
}

export interface CreateJobRequest {
  title: string;
  bonusPoints?: string;
  categoryId?: number | null;
  description?: string;
  experienceMax?: number | null;
  experienceMin?: number | null;
  headcount?: number | null;
  ownerUserId?: number | null;
  priority?: string;
  requirements?: string;
  responsibilities?: string;
  salaryMax?: number | null;
  salaryMin?: number | null;
  salaryMonths?: number | null;
  status?: JobStatus | string;
  tagIds?: number[];
  dynamicFields?: JobDynamicFields;
}

export interface UpdateJobRequest {
  title: string;
  priority: string;
  status: JobStatus | string;
  bonusPoints?: string;
  categoryId?: number | null;
  description?: string;
  experienceMax?: number | null;
  experienceMin?: number | null;
  headcount?: number | null;
  ownerUserId?: number | null;
  requirements?: string;
  responsibilities?: string;
  salaryMax?: number | null;
  salaryMin?: number | null;
  salaryMonths?: number | null;
  tagIds?: number[];
  dynamicFields?: JobDynamicFields;
}

export interface BindJobTagsRequest {
  tagIds: number[];
}

export function listJobs(params: ListJobsParams = {}): Promise<ListJobsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ApiPaginatedResponse<Job>>("/jobs", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      categoryId: params.categoryId,
      status: params.status,
    },
  }).then((response) => normalizePaginatedResponse(response, { page, pageSize }));
}

export function getJob(id: ApiId): Promise<Job> {
  return request.get<Job>(`/jobs/${id}`);
}

export function createJob(payload: CreateJobRequest): Promise<JobMutationResponse> {
  return request.post<JobMutationResponse, CreateJobRequest>("/jobs", payload);
}

export function updateJob(id: ApiId, payload: UpdateJobRequest): Promise<JobMutationResponse> {
  return request.put<JobMutationResponse, UpdateJobRequest>(`/jobs/${id}`, payload);
}

export function deleteJob(id: ApiId): Promise<void> {
  return request.delete<void>(`/jobs/${id}`);
}

export function bindJobTags(id: ApiId, payload: BindJobTagsRequest): Promise<void> {
  return request.put<void, BindJobTagsRequest>(`/jobs/${id}/tags`, payload);
}
