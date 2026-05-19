import { request } from "../request";
import type { ApiId } from "./types";

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
  fileName?: string;
  originalName?: string;
  rawText?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
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
