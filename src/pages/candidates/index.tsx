import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit3, FileText, LoaderCircle, Plus, Save, Search, Sparkles, X } from "lucide-react";
import {
  CANDIDATE_STATUS_OPTIONS,
  createCandidate,
  listCandidates,
  listJobCategories,
  listJobs,
  runScreeningTask,
  updateCandidate,
  type ApiId,
  type Candidate,
  type CreateCandidateResponse,
  type JobCategory,
  type Job,
  type RunScreeningTaskResponse,
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
  outputLanguage: string;
}

interface CandidateScreeningRunResult {
  candidate: Candidate;
  result?: RunScreeningTaskResponse;
  error?: unknown;
}

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

function formatCandidateNameList(candidates: Candidate[]): string {
  const names = candidates.map((candidate) => candidate.name.trim()).filter(Boolean);
  const visibleNames = names.slice(0, 3).join("、");
  if (!visibleNames) {
    return `${candidates.length} 位候选人`;
  }
  return candidates.length > 3 ? `${visibleNames} 等 ${candidates.length} 位候选人` : visibleNames;
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

function isSuccessfulScreeningRun(item: CandidateScreeningRunResult): boolean {
  return item.result?.status === "success";
}

function getScreeningRunMessage(results: CandidateScreeningRunResult[]): string {
  const succeeded = results.filter(isSuccessfulScreeningRun);
  const failed = results.filter((item) => !isSuccessfulScreeningRun(item));
  const parts = [`AI 筛选完成：成功 ${succeeded.length}/${results.length}，失败 ${failed.length}。`];

  if (succeeded.length > 0) {
    const scoreSummary = succeeded
      .slice(0, 3)
      .map((item) => `${item.candidate.name} ${item.result?.score ?? "-"}分`)
      .join("、");
    parts.push(`分数：${scoreSummary}${succeeded.length > 3 ? " 等" : ""}。`);
  }

  if (failed.length > 0) {
    const failedSummary = failed
      .slice(0, 3)
      .map((item) => item.candidate.name)
      .join("、");
    parts.push(`失败：${failedSummary}${failed.length > 3 ? " 等" : ""}。`);
  }

  parts.push("筛选任务列表已刷新，可查看 status、aiScore、matchLevel、recommendation 和 errorMessage。");
  return parts.join(" ");
}

async function runCandidateScreening(payload: RunCandidateScreeningPayload): Promise<CandidateScreeningRunResult[]> {
  return Promise.all(
    payload.candidates.map(async (candidate) => {
      if (!candidate.resumeId) {
        return { candidate, error: new Error("Missing resume ID") };
      }

      try {
        const result = await runScreeningTask({
          resumeId: candidate.resumeId,
          jobId: payload.jobId,
          outputLanguage: payload.outputLanguage,
        });
        return { candidate, result };
      } catch (error) {
        return { candidate, error };
      }
    }),
  );
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
      setSelectedCandidateIds(new Set(results.filter((item) => !isSuccessfulScreeningRun(item)).map((item) => String(item.candidate.id))));
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["screening-tasks"] });
    },
    onError: (error) => setBatchMessage(getErrorMessage(error, "Failed to analyze selected candidates.")),
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
    if (selectedBatchCount === 0) {
      setBatchMessage("Select at least one candidate.");
      return;
    }

    const candidatesWithoutResume = selectedBatchCandidates.filter((candidate) => !candidate.resumeId);
    if (candidatesWithoutResume.length > 0) {
      setBatchMessage(
        candidatesWithoutResume.length === 1
          ? `${formatCandidateNameList(candidatesWithoutResume)}：该候选人未上传简历。`
          : `以下候选人未上传简历：${formatCandidateNameList(candidatesWithoutResume)}。`,
      );
      return;
    }

    const candidatesWithFailedParse = selectedBatchCandidates.filter((candidate) => getCandidateResumeParseState(candidate) === "failed");
    if (candidatesWithFailedParse.length > 0) {
      setBatchMessage(`简历解析失败，请重新上传或重新解析：${formatCandidateNameList(candidatesWithFailedParse)}。`);
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
      outputLanguage: "Chinese",
    });
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
          <button
            type="button"
            onClick={submitBatchAnalyze}
            disabled={batchAnalyzeMutation.isPending || selectedBatchCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {batchAnalyzeMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Screening
          </button>
        </div>
        {batchMessage && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{batchMessage}</div>}
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
