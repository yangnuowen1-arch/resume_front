import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

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
  yearsOfExperience?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListCandidatesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  source?: string;
}

export type ListCandidatesResponse = PaginatedResponse<Candidate>;

export interface CreateCandidateRequest {
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
  yearsOfExperience?: number;
}

export type UpdateCandidateRequest = CreateCandidateRequest;

export function listCandidates(params: ListCandidatesParams = {}): Promise<ListCandidatesResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListCandidatesResponse>("/candidates", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      source: params.source,
    },
  });
}

export function createCandidate(payload: CreateCandidateRequest): Promise<void> {
  return request.post<void, CreateCandidateRequest>("/candidates", payload);
}

export function updateCandidate(id: ApiId, payload: UpdateCandidateRequest): Promise<void> {
  return request.put<void, UpdateCandidateRequest>(`/candidates/${id}`, payload);
}
