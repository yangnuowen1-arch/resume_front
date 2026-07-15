import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit3, FileText, LoaderCircle, Mail, Plus, Save, Search, Sparkles, X } from "lucide-react";
import {
  batchAnalyzeCandidates,
  CANDIDATE_STATUS_OPTIONS,
  createCandidate,
  getGoogleMailboxOAuthUrl,
  getMailboxScan,
  listCandidates,
  listJobCategories,
  listJobs,
  listScreeningTasks,
  updateCandidate,
  type ApiId,
  type BatchAnalyzeCandidateResult,
  type Candidate,
  type CreateCandidateResponse,
  type JobCategory,
  type Job,
  type MailboxScanTask,
  type ScreeningTask,
  type UpdateCandidateRequest,
  type UpdateCandidateResponse,
} from "../../api";
import { isRequestError, queryClient } from "../../request";

interface CandidateFormState {
  name: string;
  email: string;
  phone: string;
  gender: string;
  source: string;
  location: string;
  school: string;
  major: string;
  highestEducation: string;
  currentCompany: string;
  positionCategoryId: string;
  currentJobId: string;
  currentPosition: string;
  yearsOfExperience: string;
  status: string;
  rawText: string;
  language: string;
  file: File | null;
}

const defaultForm: CandidateFormState = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  source: "boss",
  location: "",
  school: "",
  major: "",
  highestEducation: "",
  currentCompany: "",
  positionCategoryId: "",
  currentJobId: "",
  currentPosition: "",
  yearsOfExperience: "",
  status: "pending_review",
  rawText: "",
  language: "",
  file: null,
};

interface SelectOption {
  value: string;
  label: string;
}

interface RunCandidateScreeningPayload {
  candidates: Candidate[];
  jobId: ApiId;
}

interface CandidateScreeningRunResult {
  candidate: Candidate;
  result?: BatchAnalyzeCandidateResult;
  error?: unknown;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 60;
const MAILBOX_POLL_INTERVAL_MS = 1_500;
const MAILBOX_POLL_TIMEOUT_MS = 2 * 60 * 1_000;

const GENDER_OPTIONS: SelectOption[] = [
  { value: "男", label: "男" },
  { value: "女", label: "女" },
];

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "boss", label: "boss" },
  { value: "email", label: "邮箱" },
];

const EDUCATION_OPTIONS: SelectOption[] = [
  { value: "专科", label: "专科" },
  { value: "本科", label: "本科" },
  { value: "硕士", label: "硕士" },
  { value: "博士", label: "博士" },
];

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function idToString(id: ApiId | undefined): string {
  return id === undefined ? "" : String(id);
}

function compact(value: string): string | undefined {
  return value.trim() || undefined;
}

function normalizeGender(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (["1", "m", "male", "男"].includes(normalized)) {
    return "男";
  }
  if (["0", "2", "f", "female", "女"].includes(normalized)) {
    return "女";
  }
  return "";
}

function normalizeSource(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "boss") {
    return "boss";
  }
  if (["email", "mail", "邮箱"].includes(normalized)) {
    return "email";
  }
  return "";
}

function normalizeEducation(value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  return EDUCATION_OPTIONS.some((option) => option.value === normalized) ? normalized : "";
}

function normalizeStatus(value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  return CANDIDATE_STATUS_OPTIONS.some((option) => option.value === normalized) ? normalized : defaultForm.status;
}

function idToNumber(id: ApiId | undefined): number | undefined {
  if (id === undefined) {
    return undefined;
  }
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCategoryOptions(categories: JobCategory[] | undefined): SelectOption[] {
  return (categories ?? []).map((category) => ({ value: String(category.id), label: category.name }));
}

function getPositionOptions(jobs: Job[] | undefined, currentJobId: string, currentPosition: string): SelectOption[] {
  const options = (jobs ?? []).map((job) => ({ value: String(job.id), label: job.title }));
  if (currentJobId && !options.some((option) => option.value === currentJobId)) {
    return [{ value: currentJobId, label: currentPosition || `#${currentJobId}` }, ...options];
  }
  return options;
}

function getCandidateJobId(candidate: Candidate): ApiId | undefined {
  return candidate.currentJob?.id ?? candidate.job?.id ?? candidate.currentJobId ?? candidate.jobId;
}

function getCandidateJobTitle(candidate: Candidate, jobTitleById?: Map<string, string>): string {
  const jobId = getCandidateJobId(candidate);
  return (
    candidate.jobTitle ||
    candidate.currentJobTitle ||
    candidate.currentJob?.title ||
    candidate.job?.title ||
    (jobId !== undefined ? jobTitleById?.get(String(jobId)) : undefined) ||
    ""
  );
}

function getCandidatePosition(candidate: Candidate, jobTitleById?: Map<string, string>): string {
  return candidate.position || getCandidateJobTitle(candidate, jobTitleById) || candidate.currentPosition || "-";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function getCandidateStatusLabel(status: string | undefined): string {
  if (!status) {
    return "-";
  }
  return CANDIDATE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

type KnownResumeParseStatus = "pending" | "parsing" | "parsed" | "failed";
type CandidateResumeParseState = "none" | KnownResumeParseStatus;

function normalizeResumeParseStatus(status: string | undefined): KnownResumeParseStatus | undefined {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "pending" || normalized === "parsing" || normalized === "parsed" || normalized === "failed") {
    return normalized;
  }
  return undefined;
}

function getCandidateResumeParseState(candidate: Candidate): CandidateResumeParseState {
  if (!candidate.resumeId) {
    return "none";
  }
  return normalizeResumeParseStatus(candidate.resumeParseStatus) ?? "pending";
}

function getResumeParseStatusLabel(state: CandidateResumeParseState): string {
  if (state === "none") {
    return "无简历";
  }
  if (state === "pending") {
    return "待解析";
  }
  if (state === "parsing") {
    return "解析中";
  }
  if (state === "parsed") {
    return "已解析";
  }
  return "解析失败";
}

function getResumeParseStatusStyle(state: CandidateResumeParseState): string {
  if (state === "none") {
    return "bg-gray-50 text-gray-600 ring-gray-200";
  }
  if (state === "parsed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (state === "parsing") {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }
  if (state === "failed") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function getResumeUploadMessage(payload: Pick<UpdateCandidateRequest, "file" | "rawText">, result: CreateCandidateResponse | UpdateCandidateResponse): string | null {
  if (!payload.file) {
    return null;
  }

  const status = normalizeResumeParseStatus(result.resumeParseStatus) ?? (payload.rawText ? "parsed" : "pending");
  if (status === "parsed") {
    return "上传成功，简历已解析。";
  }
  if (status === "parsing") {
    return "上传成功，简历解析中。";
  }
  if (status === "failed") {
    return result.resumeParseError ? `上传成功，简历解析失败：${result.resumeParseError}` : "上传成功，简历解析失败，请重新上传或重新解析。";
  }
  return "上传成功，等待解析。";
}

function isTerminalScreeningStatus(status: string | undefined): boolean {
  return status === "success" || status === "failed";
}

function getScreeningTaskId(task: ScreeningTask): string {
  return String(task.screeningResultId ?? task.id);
}

function hasOpenTrackedScreeningTasks(taskIds: string[], tasks: ScreeningTask[]): boolean {
  if (taskIds.length === 0) {
    return false;
  }

  const tasksById = new Map(tasks.map((task) => [getScreeningTaskId(task), task]));
  return taskIds.some((taskId) => {
    const task = tasksById.get(taskId);
    return !task || !isTerminalScreeningStatus(task.status);
  });
}

function isSubmittedScreeningRun(item: CandidateScreeningRunResult): boolean {
  return item.result?.status !== "failed" && item.result?.screeningResultId !== undefined;
}

function getScreeningRunMessage(results: CandidateScreeningRunResult[]): string {
  const submitted = results.filter(isSubmittedScreeningRun);
  const failed = results.filter((item) => !isSubmittedScreeningRun(item));
  const parts = [`AI 筛选任务已提交：成功 ${submitted.length}/${results.length}，失败 ${failed.length}。`];

  if (submitted.length > 0) {
    const taskSummary = submitted
      .slice(0, 3)
      .map((item) => `${item.candidate.name} #${String(item.result?.screeningResultId ?? "-")}`)
      .join("、");
    parts.push(`任务：${taskSummary}${submitted.length > 3 ? " 等" : ""}。`);
  }

  if (failed.length > 0) {
    const failedSummary = failed
      .slice(0, 3)
      .map((item) => item.candidate.name)
      .join("、");
    parts.push(`失败：${failedSummary}${failed.length > 3 ? " 等" : ""}。`);
  }

  parts.push("结果将异步生成，请到筛选任务列表查看 queued/running/success/failed、aiScore、matchLevel、recommendation 和 errorMessage。");
  return parts.join(" ");
}

async function runCandidateScreening(payload: RunCandidateScreeningPayload): Promise<CandidateScreeningRunResult[]> {
  const response = await batchAnalyzeCandidates({
    candidateIds: payload.candidates.map((candidate) => candidate.id),
    jobId: payload.jobId,
  });
  const resultByCandidateId = new Map(response.map((item) => [String(item.candidateId), item]));

  return payload.candidates.map((candidate) => {
    const result = resultByCandidateId.get(String(candidate.id));
    return result ? { candidate, result } : { candidate, error: new Error("No batch analyze result returned") };
  });
}

function getSelectOptionLabel(options: SelectOption[], value: string | undefined): string {
  if (!value) {
    return "-";
  }
  return options.find((option) => option.value === value)?.label ?? value;
}

function getStatusStyle(status: string | undefined): string {
  if (status === "evaluated" || status === "hired" || status === "offered") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "evaluating" || status === "interview") {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }
  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function formatScore(score: number | null | undefined): string {
  return typeof score === "number" ? score.toFixed(1) : "-";
}

interface MailboxScanCallback {
  taskId: string;
  email?: string;
}

function getMailboxScanCallback(): MailboxScanCallback | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("taskId")?.trim();
  if (params.get("mailboxConnected") !== "true" || !taskId) {
    return null;
  }

  return {
    taskId,
    email: params.get("email")?.trim() || undefined,
  };
}

function isMailboxScanInProgress(status: string | undefined): boolean {
  return status === "pending" || status === "running";
}

function getMailboxScanStatusLabel(status: string | undefined): string {
  if (status === "pending") {
    return "等待扫描";
  }
  if (status === "running") {
    return "扫描中";
  }
  if (status === "done") {
    return "扫描完成";
  }
  if (status === "failed") {
    return "扫描失败";
  }
  return status || "-";
}

function getMailboxScanMessage(task: MailboxScanTask): string {
  const progress = "已扫描 " + String(task.scanned ?? 0) + " 封，导入 " + String(task.imported ?? 0) + " 份简历，已跳过 " + String(task.skipped ?? 0) + " 封。";
  if (task.status === "failed") {
    return "邮箱扫描失败：" + (task.error || "未知错误");
  }
  if (task.status === "done") {
    return "邮箱扫描完成：" + progress;
  }
  return "正在扫描邮箱：" + progress;
}

export default function CandidatesPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState<CandidateFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(() => new Set());
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchTaskIds, setBatchTaskIds] = useState<string[]>([]);
  const [mailboxMessage, setMailboxMessage] = useState<string | null>(null);
  const [mailboxScanTask, setMailboxScanTask] = useState<MailboxScanTask | null>(null);
  const [mailboxScanError, setMailboxScanError] = useState<string | null>(null);
  const mailboxScanCallback = getMailboxScanCallback();
  const batchPollRef = useRef({ attempts: 0, dataUpdatedAt: 0 });
  const mailboxPollTimerRef = useRef<ReturnType<typeof window.setInterval> | undefined>(undefined);
  const mailboxPollTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const mailboxPollRunIdRef = useRef(0);
  const mailboxPollInFlightRef = useRef(false);

  const candidatesQuery = useQuery({
    queryKey: ["candidates", { keyword, source, status }],
    queryFn: () =>
      listCandidates({
        page: 1,
        pageSize: 50,
        keyword: keyword || undefined,
        source: source || undefined,
        status: status || undefined,
      }),
  });

  const jobCategoriesQuery = useQuery({
    queryKey: ["job-categories", "candidate-options"],
    queryFn: () => listJobCategories({ page: 1, pageSize: 200, status: "active" }),
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", "candidate-options", form.positionCategoryId],
    queryFn: () =>
      listJobs({
        page: 1,
        pageSize: 200,
        categoryId: form.positionCategoryId ? Number(form.positionCategoryId) : undefined,
        status: "published",
      }),
    enabled: modalOpen && !!form.positionCategoryId,
  });

  const jobsLookupQuery = useQuery({
    queryKey: ["jobs", "candidate-card-lookup"],
    queryFn: () => listJobs({ page: 1, pageSize: 200, status: "published" }),
    enabled:
      !candidatesQuery.isLoading &&
      !candidatesQuery.isError &&
      (candidatesQuery.data?.items ?? []).some((candidate) => getCandidateJobId(candidate) !== undefined),
  });

  const batchTasksQuery = useQuery({
    queryKey: ["screening-tasks", "candidate-batch", batchTaskIds],
    queryFn: () => listScreeningTasks({ page: 1, pageSize: 200, status: "all" }),
    enabled: batchTaskIds.length > 0,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const shouldPoll = hasOpenTrackedScreeningTasks(batchTaskIds, items);

      if (!shouldPoll) {
        batchPollRef.current = { attempts: 0, dataUpdatedAt: query.state.dataUpdatedAt };
        return false;
      }

      if (query.state.dataUpdatedAt > 0 && query.state.dataUpdatedAt !== batchPollRef.current.dataUpdatedAt) {
        batchPollRef.current = {
          attempts: batchPollRef.current.attempts + 1,
          dataUpdatedAt: query.state.dataUpdatedAt,
        };
      }

      return batchPollRef.current.attempts >= MAX_POLL_ATTEMPTS ? false : POLL_INTERVAL_MS;
    },
  });

  const googleMailboxOAuthMutation = useMutation({
    mutationFn: getGoogleMailboxOAuthUrl,
    onSuccess: (response) => {
      const url = response.url?.trim();
      if (!url) {
        setMailboxMessage("未收到 Google 授权地址，请稍后重试。");
        return;
      }

      // The backend owns the OAuth state cookie and URL. Do not append any
      // frontend credential, token, or state to this navigation.
      window.location.assign(url);
    },
    onError: (error) => setMailboxMessage(getErrorMessage(error, "无法发起 Google 授权，请稍后重试。")),
  });

  const stopMailboxScanPolling = useCallback(() => {
    mailboxPollRunIdRef.current += 1;
    mailboxPollInFlightRef.current = false;

    if (mailboxPollTimerRef.current !== undefined) {
      window.clearInterval(mailboxPollTimerRef.current);
      mailboxPollTimerRef.current = undefined;
    }

    if (mailboxPollTimeoutRef.current !== undefined) {
      window.clearTimeout(mailboxPollTimeoutRef.current);
      mailboxPollTimeoutRef.current = undefined;
    }
  }, []);

  const startMailboxScanPolling = useCallback(
    async (taskId: string) => {
      stopMailboxScanPolling();
      const pollRunId = mailboxPollRunIdRef.current;

      const poll = async () => {
        if (pollRunId !== mailboxPollRunIdRef.current || mailboxPollInFlightRef.current) {
          return;
        }

        mailboxPollInFlightRef.current = true;
        try {
          const task = await getMailboxScan(taskId);
          if (pollRunId !== mailboxPollRunIdRef.current) {
            return;
          }

          setMailboxScanTask(task);
          setMailboxScanError(null);

          if (task.status === "done") {
            stopMailboxScanPolling();
            await queryClient.refetchQueries({ queryKey: ["candidates"] });
            window.history.replaceState({}, "", "/candidates");
            return;
          }

          if (task.status === "failed") {
            stopMailboxScanPolling();
            setMailboxScanError(task.error || "邮箱扫描失败。");
            return;
          }

          if (!isMailboxScanInProgress(task.status)) {
            stopMailboxScanPolling();
            setMailboxScanError("邮箱扫描状态异常：" + (task.status || "未知状态") + "。");
          }
        } catch (error) {
          if (pollRunId !== mailboxPollRunIdRef.current) {
            return;
          }

          stopMailboxScanPolling();
          setMailboxScanError(getErrorMessage(error, "查询扫描状态失败。"));
        } finally {
          if (pollRunId === mailboxPollRunIdRef.current) {
            mailboxPollInFlightRef.current = false;
          }
        }
      };

      mailboxPollTimeoutRef.current = window.setTimeout(() => {
        if (pollRunId !== mailboxPollRunIdRef.current) {
          return;
        }

        stopMailboxScanPolling();
        setMailboxScanError("邮箱扫描超过 2 分钟，已停止轮询。");
      }, MAILBOX_POLL_TIMEOUT_MS);

      await poll();
      if (pollRunId !== mailboxPollRunIdRef.current || mailboxPollTimerRef.current !== undefined) {
        return;
      }

      mailboxPollTimerRef.current = window.setInterval(() => {
        void poll();
      }, MAILBOX_POLL_INTERVAL_MS);
    },
    [stopMailboxScanPolling],
  );

  const mailboxTaskId = mailboxScanCallback?.taskId;
  useEffect(() => {
    if (!mailboxTaskId) {
      return stopMailboxScanPolling;
    }

    void startMailboxScanPolling(mailboxTaskId);
    return stopMailboxScanPolling;
  }, [mailboxTaskId, startMailboxScanPolling, stopMailboxScanPolling]);

  const createCandidateMutation = useMutation({
    mutationFn: createCandidate,
    onSuccess: (result, payload) => {
      const uploadMessage = getResumeUploadMessage(payload, result);
      closeModal();
      if (uploadMessage) {
        setBatchMessage(uploadMessage);
      }
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to create candidate.")),
  });

  const updateCandidateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: ApiId; payload: UpdateCandidateRequest }) => updateCandidate(id, payload),
    onSuccess: (result, variables) => {
      const uploadMessage = getResumeUploadMessage(variables.payload, result);
      closeModal();
      if (uploadMessage) {
        setBatchMessage(uploadMessage);
      }
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "Failed to update candidate.")),
  });

  const batchAnalyzeMutation = useMutation({
    mutationFn: runCandidateScreening,
    onSuccess: (results) => {
      setBatchMessage(getScreeningRunMessage(results));
      setSelectedCandidateIds(new Set(results.filter((item) => !isSubmittedScreeningRun(item)).map((item) => String(item.candidate.id))));
      batchPollRef.current = { attempts: 0, dataUpdatedAt: 0 };
      setBatchTaskIds(Array.from(new Set(results.filter(isSubmittedScreeningRun).map((item) => String(item.result?.screeningResultId)))));
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["screening-tasks"] });
    },
    onError: (error) => {
      setBatchTaskIds([]);
      setBatchMessage(getErrorMessage(error, "Failed to analyze selected candidates."));
    },
  });

  const isSaving = createCandidateMutation.isPending || updateCandidateMutation.isPending;

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCandidate(null);
    setForm(defaultForm);
    setFormError(null);
  };

  const openCreate = () => {
    setSelectedCandidate(null);
    setForm(defaultForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (candidate: Candidate) => {
    const currentJobId = getCandidateJobId(candidate);
    const currentPosition = candidate.currentPosition ?? getCandidateJobTitle(candidate);
    setSelectedCandidate(candidate);
    setForm({
      name: candidate.name,
      email: candidate.email ?? "",
      phone: candidate.phone ?? "",
      gender: normalizeGender(candidate.gender),
      source: normalizeSource(candidate.source),
      location: candidate.location ?? "",
      school: candidate.school ?? "",
      major: candidate.major ?? "",
      highestEducation: normalizeEducation(candidate.highestEducation),
      currentCompany: candidate.currentCompany ?? "",
      positionCategoryId: idToString(candidate.positionCategoryId),
      currentJobId: idToString(currentJobId),
      currentPosition,
      yearsOfExperience: idToString(candidate.yearsOfExperience),
      status: normalizeStatus(candidate.status),
      rawText: "",
      language: candidate.resumeLanguage ?? "",
      file: null,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildCommonPayload = (): UpdateCandidateRequest | null => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Candidate name is required.");
      return null;
    }

    const status = normalizeStatus(form.status);

    return {
      name,
      email: compact(form.email),
      phone: compact(form.phone),
      gender: compact(form.gender),
      source: compact(form.source),
      location: compact(form.location),
      school: compact(form.school),
      major: compact(form.major),
      highestEducation: compact(form.highestEducation),
      currentCompany: compact(form.currentCompany),
      positionCategoryId: idToNumber(form.positionCategoryId),
      currentJobId: idToNumber(form.currentJobId),
      currentPosition: compact(form.currentPosition),
      yearsOfExperience: toOptionalNumber(form.yearsOfExperience),
      status,
    };
  };

  const submitCandidate = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const commonPayload = buildCommonPayload();
    if (!commonPayload) {
      return;
    }

    if (selectedCandidate) {
      updateCandidateMutation.mutate({
        id: selectedCandidate.id,
        payload: {
          ...commonPayload,
          file: form.file ?? undefined,
          rawText: form.file ? compact(form.rawText) : undefined,
          language: compact(form.language),
        },
      });
      return;
    }

    if (!form.file) {
      setFormError("Resume file is required.");
      return;
    }

    createCandidateMutation.mutate({
      ...commonPayload,
      file: form.file,
      rawText: compact(form.rawText),
      language: compact(form.language),
    });
  };

  const currentCandidates = candidatesQuery.data?.items ?? [];
  const selectedBatchCandidates = currentCandidates.filter((candidate) => selectedCandidateIds.has(String(candidate.id)));
  const selectedBatchCandidateIds = selectedBatchCandidates.map((candidate) => candidate.id);
  const selectedBatchCount = selectedBatchCandidateIds.length;
  const selectedBatchJobIds = Array.from(
    new Set(
      selectedBatchCandidates
        .map((candidate) => getCandidateJobId(candidate))
        .filter((jobId): jobId is ApiId => jobId !== undefined)
        .map((jobId) => String(jobId)),
    ),
  );
  const categoryOptions = getCategoryOptions(jobCategoriesQuery.data?.items);
  const currentPositionOptions = getPositionOptions(jobsQuery.data?.items, form.currentJobId, form.currentPosition);
  const jobTitleById = new Map((jobsLookupQuery.data?.items ?? []).map((job) => [String(job.id), job.title]));
  const batchTaskItems = batchTasksQuery.data?.items ?? [];
  const activeBatchTaskCount = batchTaskIds.filter((taskId) => {
    const task = batchTaskItems.find((item) => getScreeningTaskId(item) === taskId);
    return !task || !isTerminalScreeningStatus(task.status);
  }).length;

  const toggleCandidateSelection = (candidateId: ApiId, checked: boolean) => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      const key = String(candidateId);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const submitBatchAnalyze = () => {
    setBatchMessage(null);
    setBatchTaskIds([]);
    batchPollRef.current = { attempts: 0, dataUpdatedAt: 0 };
    if (selectedBatchCount === 0) {
      setBatchMessage("Select at least one candidate.");
      return;
    }

    if (selectedBatchJobIds.length === 0) {
      setBatchMessage("Select candidates with a current position.");
      return;
    }

    if (selectedBatchJobIds.length > 1) {
      setBatchMessage("Select candidates for the same current position.");
      return;
    }

    const selectedJobId = Number(selectedBatchJobIds[0]);
    if (!Number.isInteger(selectedJobId) || selectedJobId <= 0) {
      setBatchMessage("Selected position is missing a valid job ID.");
      return;
    }

    batchAnalyzeMutation.mutate({
      candidates: selectedBatchCandidates,
      jobId: selectedJobId,
    });
  };

  const beginGoogleMailboxOAuth = () => {
    setMailboxMessage(null);
    googleMailboxOAuthMutation.mutate();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Candidates</h1>
          <p className="text-sm text-gray-600 md:text-base">Create and maintain candidate profiles.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Candidate
        </button>
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <SearchBox value={keywordInput} placeholder="Search name, email, or phone..." onChange={setKeywordInput} onSubmit={() => setKeyword(keywordInput.trim())} />
          <select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            {CANDIDATE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setKeyword(keywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
            Search
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-gray-700">Selected {selectedBatchCount}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitBatchAnalyze}
              disabled={batchAnalyzeMutation.isPending || selectedBatchCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {batchAnalyzeMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run Screening
            </button>
            <button
              type="button"
              onClick={beginGoogleMailboxOAuth}
              disabled={googleMailboxOAuthMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleMailboxOAuthMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              从邮箱拉取候选人信息
            </button>
          </div>
        </div>
        {batchMessage && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{batchMessage}</div>}
        {activeBatchTaskCount > 0 && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            正在轮询 {activeBatchTaskCount} 个筛选任务，完成或失败后会自动停止。
          </div>
        )}
        {mailboxMessage && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{mailboxMessage}</div>}
        {mailboxScanCallback && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="text-sm font-medium text-sky-900">邮箱扫描{mailboxScanCallback.email ? " · " + mailboxScanCallback.email : ""}</div>
            {mailboxScanError ? (
              <div className="mt-1 text-sm text-rose-700">{mailboxScanError}</div>
            ) : mailboxScanTask ? (
              <>
                <div className="mt-1 text-sm text-sky-800">{getMailboxScanMessage(mailboxScanTask)}</div>
                <div className="mt-1 text-xs text-sky-700">
                  状态：{getMailboxScanStatusLabel(mailboxScanTask.status)} · 已扫描 {mailboxScanTask.scanned ?? 0} · 已导入 {mailboxScanTask.imported ?? 0} · 已跳过 {mailboxScanTask.skipped ?? 0}
                </div>
                {mailboxScanTask.status === "failed" && mailboxScanTask.error && <div className="mt-1 text-xs text-rose-700">错误：{mailboxScanTask.error}</div>}
              </>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-sm text-sky-800">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在获取邮箱扫描进度…
              </div>
            )}
          </div>
        )}
      </section>

      <QueryState loading={candidatesQuery.isLoading} error={candidatesQuery.error} fallback="Failed to load candidates." />
      {!candidatesQuery.isLoading && !candidatesQuery.isError && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
            Total {candidatesQuery.data?.total ?? 0} candidates
          </div>
          <div className="divide-y divide-gray-200">
            {(candidatesQuery.data?.items ?? []).map((candidate) => {
              const positionLabel = getCandidatePosition(candidate, jobTitleById);
              const resumeParseState = getCandidateResumeParseState(candidate);

              return (
                <div key={String(candidate.id)} className="p-4 transition-colors hover:bg-gray-50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidateIds.has(String(candidate.id))}
                        onChange={(event) => toggleCandidateSelection(candidate.id, event.target.checked)}
                        aria-label={`Select ${candidate.name}`}
                        className="mt-3 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                        {initials(candidate.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-gray-900">{candidate.name}</h3>
                          {candidate.status && <StatusBadge value={candidate.status} />}
                          {candidate.source && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">{getSelectOptionLabel(SOURCE_OPTIONS, candidate.source)}</span>}
                        </div>
                        <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                          <span>Email: {candidate.email || "-"}</span>
                          <span>Phone: {candidate.phone || "-"}</span>
                          <span>Location: {candidate.location || "-"}</span>
                          <span>Experience: {candidate.yearsOfExperience ?? "-"} years</span>
                          <span>Position: {positionLabel}</span>
                          <span>AI Score: {formatScore(candidate.aiScore)}</span>
                          <span>Screening: {candidate.screeningStatus || "-"}</span>
                          <span>Resume: {candidate.resumeFilename || (candidate.resumeId ? `#${String(candidate.resumeId)}` : "-")}</span>
                          <span className="flex min-w-0 items-center gap-1">
                            <span>简历解析:</span>
                            <ResumeParseBadge candidate={candidate} />
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {candidate.resumeFileUrl && (
                            <a href={candidate.resumeFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
                              <FileText className="h-4 w-4" />
                              {candidate.resumeFilename || "Open resume"}
                            </a>
                          )}
                        </div>
                        {resumeParseState === "failed" && candidate.resumeParseError && <p className="mt-1 text-xs text-rose-600">解析错误：{candidate.resumeParseError}</p>}
                        <p className="mt-2 text-sm text-gray-600">
                          {[candidate.currentPosition, candidate.currentCompany].filter(Boolean).join(" · ") || [candidate.school, candidate.major].filter(Boolean).join(" · ") || "No career or education info."}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openEdit(candidate)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
            {(candidatesQuery.data?.items ?? []).length === 0 && <EmptyState label="No candidates found." />}
          </div>
        </section>
      )}

      {modalOpen && (
        <Modal title={selectedCandidate ? "Edit Candidate" : "Create Candidate"} onClose={closeModal}>
          <form onSubmit={submitCandidate} className="space-y-5 p-6">
            <FileField label={selectedCandidate ? "Replace Resume" : "Resume File"} file={form.file} onChange={(file) => setForm({ ...form, file })} required={!selectedCandidate} />
            {selectedCandidate?.resumeFileUrl && <ResumeLink url={selectedCandidate.resumeFileUrl} filename={selectedCandidate.resumeFilename} />}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <SelectField label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} options={GENDER_OPTIONS} placeholder="请选择性别" />
              <SelectField label="Source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} options={SOURCE_OPTIONS} placeholder="请选择来源" />
              <SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={CANDIDATE_STATUS_OPTIONS} placeholder="请选择状态" />
              <Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
              <Field label="School" value={form.school} onChange={(value) => setForm({ ...form, school: value })} />
              <Field label="Major" value={form.major} onChange={(value) => setForm({ ...form, major: value })} />
              <SelectField label="Highest Education" value={form.highestEducation} onChange={(value) => setForm({ ...form, highestEducation: value })} options={EDUCATION_OPTIONS} placeholder="请选择学历" />
              <Field label="Years of Experience" type="number" value={form.yearsOfExperience} onChange={(value) => setForm({ ...form, yearsOfExperience: value })} />
              <Field label="Current Company" value={form.currentCompany} onChange={(value) => setForm({ ...form, currentCompany: value })} />
              <SelectField
                label="Position Category"
                value={form.positionCategoryId}
                onChange={(value) => setForm({ ...form, positionCategoryId: value, currentJobId: "", currentPosition: "" })}
                options={categoryOptions}
                placeholder="请选择职位类别"
              />
              <SelectField
                label="Current Position"
                value={form.currentJobId}
                onChange={(value) => {
                  const selectedJob = jobsQuery.data?.items.find((job) => String(job.id) === value);
                  setForm({
                    ...form,
                    currentJobId: value,
                    currentPosition: selectedJob?.title ?? "",
                  });
                }}
                options={currentPositionOptions}
                placeholder={form.positionCategoryId ? "请选择具体职位" : "先选择职位类别"}
                disabled={!form.positionCategoryId}
              />
              <Field label="Resume Language" value={form.language} onChange={(value) => setForm({ ...form, language: value })} />
            </div>
            {(!selectedCandidate || form.file !== null) && <TextArea label="Raw Text" value={form.rawText} onChange={(value) => setForm({ ...form, rawText: value })} />}
            <FormActions error={formError} isSaving={isSaving} onCancel={closeModal} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBox({ value, placeholder, onChange, onSubmit }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function QueryState({ loading, error, fallback }: { loading: boolean; error: unknown; fallback: string }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">{getErrorMessage(error, fallback)}</div>;
  }

  return null;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{label}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(value)}`}>{getCandidateStatusLabel(value)}</span>;
}

function ResumeParseBadge({ candidate }: { candidate: Candidate }) {
  const state = getCandidateResumeParseState(candidate);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${getResumeParseStatusStyle(state)}`} title={state === "failed" ? candidate.resumeParseError : undefined}>
      {getResumeParseStatusLabel(state)}
    </span>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileField({ label, file, onChange, required }: { label: string; file: File | null; onChange: (file: File | null) => void; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <input
        type="file"
        required={required}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
      {file && <span className="block text-xs font-normal text-gray-500">{file.name}</span>}
    </label>
  );
}

function ResumeLink({ url, filename }: { url: string; filename?: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{filename || "Current resume"}</span>
      </a>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium text-gray-700">
      {label}
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function FormActions({ error, isSaving, onCancel }: { error: string | null; isSaving: boolean; onCancel: () => void }) {
  return (
    <>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
        <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-60">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </>
  );
}
