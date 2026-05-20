import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export type ApplicationStatus = "submitted" | "screening" | "shortlisted" | "rejected" | string;

export interface Application {
  id: ApiId;
  jobId: number;
  jobTitle?: string;
  candidateId?: number;
  candidateName?: string;
  resumeId: number;
  resumeName?: string;
  resumeFilename?: string;
  source?: string;
  status: ApplicationStatus;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListApplicationsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  jobId?: number;
  candidateId?: number;
  resumeId?: number;
  status?: ApplicationStatus;
  source?: string;
}

export type ListApplicationsResponse = PaginatedResponse<Application>;

export interface CreateApplicationRequest {
  jobId: number;
  resumeId: number;
  candidateId?: number;
  source?: string;
  status?: ApplicationStatus;
  remark?: string;
}

export function listApplications(params: ListApplicationsParams = {}): Promise<ListApplicationsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListApplicationsResponse>("/applications", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      jobId: params.jobId,
      candidateId: params.candidateId,
      resumeId: params.resumeId,
      status: params.status,
      source: params.source,
    },
  });
}

export function createApplication(payload: CreateApplicationRequest): Promise<void> {
  return request.post<void, CreateApplicationRequest>("/applications", payload);
}
