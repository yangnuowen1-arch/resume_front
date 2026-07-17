import { request } from "../request";
import { normalizePaginatedResponse, type ApiId, type ApiPaginatedResponse, type PaginatedResponse } from "./types";

/** Toggle mock batch-status responses until the backend ships GET /screening-tasks/status. */
const USE_SCREENING_STATUS_MOCK = import.meta.env.VITE_USE_SCREENING_STATUS_MOCK === "true";

export type ScreeningTaskStatus = "queued" | "running" | "success" | "failed" | string;

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
  matchLevel?: string | null;
  recommendation?: string | null;
  summary?: string | null;
  markdownReport?: string | null;
  errorMessage?: string | null;
}

export type RequirementMatchStatus = "pass" | "partial" | "miss" | string;

export interface RequirementEvidence {
  /** Text snippet copied verbatim from the resume. Must be an exact substring of resumeText for precise highlighting. */
  text: string;
  /** Optional character start index within resumeText. */
  start?: number | null;
  /** Optional character end index within resumeText. */
  end?: number | null;
}

export interface ScreeningRequirement {
  id?: ApiId;
  /** The job requirement being matched. */
  label: string;
  /** Candidate-side finding for this requirement. */
  candidateSituation?: string | null;
  status: RequirementMatchStatus;
  /** Optional note explaining the match (e.g. "experience is shallow"). */
  comment?: string | null;
  evidence?: RequirementEvidence[];
}

export interface ScreeningSummarySection {
  text?: string | null;
}

export interface ScreeningCandidateInfoSection {
  name?: string | null;
  appliedPosition?: string | null;
  currentTitle?: string | null;
  yearsOfExperience?: number | null;
  highestEducation?: string | null;
  taskStatus?: ScreeningTaskStatus | null;
  taskErrorMessage?: string | null;
}

export interface ScreeningAssessmentSection {
  score?: number | null;
  matchLevel?: string | null;
  recommendation?: string | null;
}

export interface ScreeningRequirementsComparisonSection {
  items?: ScreeningRequirement[];
  matchedItems?: ScreeningRequirement[];
  attentionItems?: ScreeningRequirement[];
}

export interface ScreeningCandidateAnalysisSection {
  strengths?: string[];
  weaknesses?: string[];
  risks?: string[];
  suggestedInterviewQuestions?: string[];
}

export interface ScreeningFinalRecommendationSection {
  recommendation?: string | null;
  text?: string | null;
}

export interface ScreeningResumeSection {
  text?: string | null;
  textAvailable?: boolean;
  highlightAvailable?: boolean;
}

export interface ScreeningFallbackSection {
  markdownReport?: string | null;
  shouldUseMarkdownFallback?: boolean;
}

export interface ScreeningTaskDetailSections {
  summary?: ScreeningSummarySection;
  candidateInfo?: ScreeningCandidateInfoSection;
  assessment?: ScreeningAssessmentSection;
  requirementsComparison?: ScreeningRequirementsComparisonSection;
  candidateAnalysis?: ScreeningCandidateAnalysisSection;
  finalRecommendation?: ScreeningFinalRecommendationSection;
  resume?: ScreeningResumeSection;
  fallback?: ScreeningFallbackSection;
}

export interface ScreeningTaskDetail extends ScreeningTask {
  /** Full resume plain text (Resume.rawText). */
  resumeText?: string | null;
  /** Structured requirement comparison results. */
  requirements?: ScreeningRequirement[];
  /** Structured report sections returned by the screening backend. */
  sections?: ScreeningTaskDetailSections | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
}

export interface ListScreeningTasksParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: ScreeningTaskStatus | "all";
  jobId?: number;
  candidateId?: number;
}

export type ListScreeningTasksResponse = PaginatedResponse<ScreeningTask>;

export interface RunScreeningTaskRequest {
  resumeId: ApiId;
  jobId: ApiId;
  outputLanguage?: string;
}

export interface RunScreeningTaskResponse {
  screeningResultId: ApiId;
  applicationId: ApiId;
  resumeId: ApiId;
  jobId: ApiId;
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

export function getScreeningTask(id: ApiId): Promise<ScreeningTaskDetail> {
  return request.get<ScreeningTaskDetail>(`/screening-tasks/${id}`);
}

/** Minimal status fields for lightweight polling of many tasks at once. */
export interface ScreeningTaskStatusItem {
  id: ApiId;
  status: ScreeningTaskStatus;
  aiScore?: number | null;
  errorMessage?: string | null;
}

export type GetScreeningTaskStatusResponse = ScreeningTaskStatusItem[];

/**
 * Lightweight batch status query for polling.
 * GET /screening-tasks/status?ids=12,13,14
 * Returns only id/status/aiScore/errorMessage to keep polling cheap.
 */
export function getScreeningTaskStatus(ids: ApiId[]): Promise<GetScreeningTaskStatusResponse> {
  if (USE_SCREENING_STATUS_MOCK) {
    return mockGetScreeningTaskStatus(ids);
  }
  return request.get<GetScreeningTaskStatusResponse>("/screening-tasks/status", {
    params: { ids: ids.join(",") },
  });
}

/**
 * Mock that simulates a task progressing queued -> running -> success over a few polls.
 * Each id gets a deterministic-ish lifecycle so the polling UI can be exercised offline.
 */
const mockStatusProgress = new Map<string, number>();

function mockGetScreeningTaskStatus(ids: ApiId[]): Promise<GetScreeningTaskStatusResponse> {
  const items: ScreeningTaskStatusItem[] = ids.map((id) => {
    const key = String(id);
    const tick = (mockStatusProgress.get(key) ?? 0) + 1;
    mockStatusProgress.set(key, tick);

    if (tick <= 1) {
      return { id, status: "queued", aiScore: null, errorMessage: null };
    }
    if (tick <= 3) {
      return { id, status: "running", aiScore: null, errorMessage: null };
    }
    return { id, status: "success", aiScore: 80 + (Number(id) % 20), errorMessage: null };
  });

  return new Promise((resolve) => setTimeout(() => resolve(items), 300));
}
