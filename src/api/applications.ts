import { request } from "../request";

export type ApplicationStatus = "submitted" | "screening" | "shortlisted" | "rejected" | string;

export interface CreateApplicationRequest {
  jobId: number;
  resumeId: number;
  candidateId?: number;
  source?: string;
  status?: ApplicationStatus;
  remark?: string;
}

export function createApplication(payload: CreateApplicationRequest): Promise<void> {
  return request.post<void, CreateApplicationRequest>("/applications", payload);
}
