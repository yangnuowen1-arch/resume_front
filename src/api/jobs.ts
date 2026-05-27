import { request } from "../request";
import type { Tag } from "./tags";
import type { ApiId, PaginatedResponse } from "./types";

export type JobStatus = "draft" | "published" | "closed";

export interface Job {
  id: ApiId;
  title: string;
  categoryId?: number;
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
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryMonths?: number;
  headcount?: number;
  ownerUserId?: number;
  ownerName?: string;
  priority?: string;
  status: JobStatus | string;
  tags?: Tag[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  status?: JobStatus | string;
}

export type ListJobsResponse = PaginatedResponse<Job>;

export interface CreateJobRequest {
  title: string;
  bonusPoints?: string;
  categoryId?: number;
  department?: string;
  description?: string;
  educationLevel?: string;
  employmentType?: string;
  experienceMax?: number;
  experienceMin?: number;
  headcount?: number;
  ownerUserId?: number;
  priority?: string;
  requirements?: string;
  responsibilities?: string;
  salaryMax?: number;
  salaryMin?: number;
  salaryMonths?: number;
  status?: JobStatus | string;
  workLocation?: string;
  workType?: string;
}

export interface UpdateJobRequest {
  title: string;
  priority: string;
  status: JobStatus | string;
  bonusPoints?: string;
  categoryId?: number;
  department?: string;
  description?: string;
  educationLevel?: string;
  employmentType?: string;
  experienceMax?: number;
  experienceMin?: number;
  headcount?: number;
  ownerUserId?: number;
  requirements?: string;
  responsibilities?: string;
  salaryMax?: number;
  salaryMin?: number;
  salaryMonths?: number;
  workLocation?: string;
  workType?: string;
}

export interface BindJobTagsRequest {
  tagIds: number[];
}

export function listJobs(params: ListJobsParams = {}): Promise<ListJobsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListJobsResponse>("/jobs", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      categoryId: params.categoryId,
      status: params.status,
    },
  });
}

export function createJob(payload: CreateJobRequest): Promise<Job> {
  return request.post<Job, CreateJobRequest>("/jobs", payload);
}

export function updateJob(id: ApiId, payload: UpdateJobRequest): Promise<void> {
  return request.put<void, UpdateJobRequest>(`/jobs/${id}`, payload);
}

export function bindJobTags(id: ApiId, payload: BindJobTagsRequest): Promise<void> {
  return request.put<void, BindJobTagsRequest>(`/jobs/${id}/tags`, payload);
}
