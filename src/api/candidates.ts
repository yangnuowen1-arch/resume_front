import { request } from "../request";
import { normalizePaginatedResponse, type ApiId, type ApiPaginatedResponse, type PaginatedResponse } from "./types";

export type CandidateStatus = "new" | "pending_review" | "evaluating" | "evaluated" | "interview" | "offered" | "hired" | "rejected";

export const CANDIDATE_STATUS_OPTIONS: Array<{ value: CandidateStatus; label: string }> = [
  { value: "new", label: "新候选人" },
  { value: "pending_review", label: "待评估" },
  { value: "evaluating", label: "评估中" },
  { value: "evaluated", label: "已评估" },
  { value: "interview", label: "面试中" },
  { value: "offered", label: "已发 Offer" },
  { value: "hired", label: "已录用" },
  { value: "rejected", label: "已拒绝" },
];

export interface Candidate {
  id: ApiId;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  source?: string;
  location?: string;
  school?: string;
  major?: string;
  highestEducation?: string;
  currentCompany?: string;
  currentPosition?: string;
  positionCategoryId?: ApiId;
  positionCategoryName?: string;
  currentJobId?: ApiId;
  yearsOfExperience?: number;
  status?: CandidateStatus | string;
  position?: string;
  resumeId?: ApiId;
  resumeFilename?: string;
  resumeFileUrl?: string;
  resumeLanguage?: string;
  resumeUploadedAt?: string;
  resumeEvaluated?: boolean;
  screeningStatus?: string;
  aiScore?: number | null;
  applicationId?: ApiId;
  jobId?: ApiId;
  jobTitle?: string;
  currentJobTitle?: string;
  currentJob?: CandidateJob;
  job?: CandidateJob;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateJob {
  id: ApiId;
  title?: string;
  categoryId?: ApiId | null;
  categoryName?: string;
  status?: string;
}

export interface ListCandidatesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  source?: string;
  status?: CandidateStatus | "all" | string;
}

export type ListCandidatesResponse = PaginatedResponse<Candidate>;

export interface CreateCandidateRequest {
  file?: File;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  source?: string;
  status: CandidateStatus | string;
  location?: string;
  school?: string;
  major?: string;
  highestEducation?: string;
  currentCompany?: string;
  positionCategoryId?: ApiId;
  currentJobId?: ApiId;
  currentPosition?: string;
  yearsOfExperience?: number;
  rawText?: string;
  language?: string;
}

export interface CreateCandidateResponse {
  id: ApiId;
  resumeId?: ApiId;
}

export interface UpdateCandidateRequest {
  file?: File;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  source?: string;
  status: CandidateStatus | string;
  location?: string;
  school?: string;
  major?: string;
  highestEducation?: string;
  currentCompany?: string;
  positionCategoryId?: ApiId;
  currentJobId?: ApiId;
  currentPosition?: string;
  yearsOfExperience?: number;
  rawText?: string;
  language?: string;
}

export interface UpdateCandidateResponse {
  id: ApiId;
  resumeId?: ApiId;
}

export interface BatchAnalyzeCandidatesRequest {
  candidateIds: ApiId[];
  jobId?: ApiId;
}

export interface BatchAnalyzeCandidateItem {
  candidateId: ApiId;
  resumeId?: ApiId;
  applicationId?: ApiId;
  status: string;
}

export interface BatchAnalyzeCandidatesResponse {
  total: number;
  queued: number;
  failed: number;
  items: BatchAnalyzeCandidateItem[];
}

export function listCandidates(params: ListCandidatesParams = {}): Promise<ListCandidatesResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ApiPaginatedResponse<Candidate>>("/candidates", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      source: params.source,
      status: params.status === "all" ? undefined : params.status,
    },
  }).then((response) => normalizePaginatedResponse(response, { page, pageSize }));
}

export function createCandidate(payload: CreateCandidateRequest): Promise<CreateCandidateResponse> {
  if (!payload.file) {
    return request.post<CreateCandidateResponse, CreateCandidateRequest>("/candidates", payload);
  }

  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("name", payload.name);

  if (payload.email) formData.append("email", payload.email);
  if (payload.phone) formData.append("phone", payload.phone);
  if (payload.gender) formData.append("gender", payload.gender);
  if (payload.currentCompany) formData.append("currentCompany", payload.currentCompany);
  if (payload.positionCategoryId !== undefined) formData.append("positionCategoryId", String(payload.positionCategoryId));
  if (payload.currentJobId !== undefined) formData.append("currentJobId", String(payload.currentJobId));
  if (payload.currentPosition) formData.append("currentPosition", payload.currentPosition);
  if (payload.yearsOfExperience !== undefined) formData.append("yearsOfExperience", String(payload.yearsOfExperience));
  if (payload.highestEducation) formData.append("highestEducation", payload.highestEducation);
  if (payload.school) formData.append("school", payload.school);
  if (payload.major) formData.append("major", payload.major);
  if (payload.location) formData.append("location", payload.location);
  if (payload.source) formData.append("source", payload.source);
  if (payload.status) formData.append("status", payload.status);
  if (payload.rawText) formData.append("rawText", payload.rawText);
  if (payload.language) formData.append("language", payload.language);

  return request.post<CreateCandidateResponse, FormData>("/candidates", formData);
}

export function updateCandidate(id: ApiId, payload: UpdateCandidateRequest): Promise<UpdateCandidateResponse> {
  const formData = new FormData();
  formData.append("name", payload.name);

  if (payload.file) formData.append("file", payload.file);
  if (payload.email) formData.append("email", payload.email);
  if (payload.phone) formData.append("phone", payload.phone);
  if (payload.gender) formData.append("gender", payload.gender);
  if (payload.currentCompany) formData.append("currentCompany", payload.currentCompany);
  if (payload.positionCategoryId !== undefined) formData.append("positionCategoryId", String(payload.positionCategoryId));
  if (payload.currentJobId !== undefined) formData.append("currentJobId", String(payload.currentJobId));
  if (payload.currentPosition) formData.append("currentPosition", payload.currentPosition);
  if (payload.yearsOfExperience !== undefined) formData.append("yearsOfExperience", String(payload.yearsOfExperience));
  if (payload.highestEducation) formData.append("highestEducation", payload.highestEducation);
  if (payload.school) formData.append("school", payload.school);
  if (payload.major) formData.append("major", payload.major);
  if (payload.location) formData.append("location", payload.location);
  if (payload.source) formData.append("source", payload.source);
  if (payload.status) formData.append("status", payload.status);
  if (payload.rawText) formData.append("rawText", payload.rawText);
  if (payload.language) formData.append("language", payload.language);

  return request.put<UpdateCandidateResponse, FormData>(`/candidates/${id}`, formData);
}

export function batchAnalyzeCandidates(payload: BatchAnalyzeCandidatesRequest): Promise<BatchAnalyzeCandidatesResponse> {
  return request.post<BatchAnalyzeCandidatesResponse, BatchAnalyzeCandidatesRequest>("/candidates/batch-analyze", payload);
}
