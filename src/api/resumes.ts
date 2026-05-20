import { request } from "../request";
import type { ApiId, PaginatedResponse } from "./types";

export interface UploadResumeRequest {
  file: File;
  candidateId?: number;
  rawText?: string;
  language?: string;
}

export interface ResumeResponse {
  id?: ApiId;
  resumeId?: ApiId;
  candidateId?: number;
  candidateName?: string;
  fileName?: string;
  originalName?: string;
  originalFilename?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  rawText?: string;
  language?: string;
  uploadBy?: number;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListResumesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  candidateId?: number;
  language?: string;
}

export type ListResumesResponse = PaginatedResponse<ResumeResponse>;

export function listResumes(params: ListResumesParams = {}): Promise<ListResumesResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ListResumesResponse>("/resumes", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      candidateId: params.candidateId,
      language: params.language,
    },
  });
}

export function uploadResume(payload: UploadResumeRequest): Promise<ResumeResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);

  if (payload.candidateId !== undefined) {
    formData.append("candidateId", String(payload.candidateId));
  }
  if (payload.rawText?.trim()) {
    formData.append("rawText", payload.rawText.trim());
  }
  if (payload.language?.trim()) {
    formData.append("language", payload.language.trim());
  }

  return request.post<ResumeResponse, FormData>("/resumes/upload", formData);
}
