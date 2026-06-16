import { request } from "../request";
import { normalizePaginatedResponse, type ApiId, type ApiPaginatedResponse, type PaginatedResponse } from "./types";

export type ScreeningTaskStatus = "pending" | "success" | "failed" | "all" | string;

export interface ScreeningTask {
  id: ApiId;
  screeningResultId?: ApiId;
  applicationId?: ApiId;
  resumeId?: ApiId;
  candidateId?: ApiId;
  candidate?: string;
  candidateName?: string;
  jobId?: ApiId;
  jobTitle?: string;
  position?: string;
  aiScore?: number | null;
  score?: number | null;
  status: ScreeningTaskStatus;
  date?: string;
  createdAt?: string;
  createdBy?: ApiId;
  matchLevel?: string;
  recommendation?: string;
  summary?: string;
  markdownReport?: string;
  errorMessage?: string | null;
}

export interface ListScreeningTasksParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: ScreeningTaskStatus;
  jobId?: number;
  candidateId?: number;
}

export type ListScreeningTasksResponse = PaginatedResponse<ScreeningTask>;

export interface RunScreeningTaskRequest {
  resumeId: ApiId;
  jobId: ApiId;
  outputLanguage: string;
}

export interface RunScreeningTaskResponse {
  screeningResultId: ApiId;
  applicationId: ApiId;
  resumeId: ApiId;
  jobId: ApiId;
  score: number;
  matchLevel: string;
  recommendation: string;
  summary: string;
  markdownReport: string;
  status: ScreeningTaskStatus;
}

export function listScreeningTasks(params: ListScreeningTasksParams = {}): Promise<ListScreeningTasksResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ApiPaginatedResponse<ScreeningTask>>("/screening-tasks", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      status: params.status === "all" ? undefined : params.status,
      jobId: params.jobId,
      candidateId: params.candidateId,
    },
  }).then((response) => normalizePaginatedResponse(response, { page, pageSize }));
}

export function runScreeningTask(payload: RunScreeningTaskRequest): Promise<RunScreeningTaskResponse> {
  return request.post<RunScreeningTaskResponse, RunScreeningTaskRequest>("/screening-tasks/run", payload);
}
