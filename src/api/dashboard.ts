import { request } from "../request";

export interface DashboardSummary {
  totalResumes: number;
  pendingScreening: number;
  recommended: number;
  rejected: number;
  generatedAt: string;
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request.get<DashboardSummary>("/dashboard/summary");
}
