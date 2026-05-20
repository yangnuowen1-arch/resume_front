import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, File, LoaderCircle, Search, Upload, X } from "lucide-react";
import { createApplication, listJobs, listResumes, uploadResume, type ApiId, type ResumeResponse } from "../../api";
import { isRequestError, queryClient } from "../../request";

interface UploadedFileResult {
  fileName: string;
  resumeId: number;
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRequiredNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function apiIdToNumber(value: ApiId | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function getResumeId(resume: ResumeResponse): number | null {
  return apiIdToNumber(resume.resumeId ?? resume.id);
}

function getResumeFilename(resume: ResumeResponse): string {
  return resume.originalFilename ?? resume.originalName ?? resume.fileName ?? `Resume #${String(resume.resumeId ?? resume.id ?? "-")}`;
}

function formatFileSize(size: number | undefined): string {
  if (!size) {
    return "-";
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function ResumesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [language, setLanguage] = useState("zh-CN");
  const [source, setSource] = useState("manual_upload");
  const [status, setStatus] = useState("submitted");
  const [rawText, setRawText] = useState("");
  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadedResults, setUploadedResults] = useState<UploadedFileResult[]>([]);
  const [resumeKeywordInput, setResumeKeywordInput] = useState("");
  const [resumeKeyword, setResumeKeyword] = useState("");
  const [resumeCandidateId, setResumeCandidateId] = useState("");
  const [resumeLanguage, setResumeLanguage] = useState("");

  const jobsQuery = useQuery({
    queryKey: ["jobs", "resume-upload-options"],
    queryFn: () => listJobs({ page: 1, pageSize: 200, status: "published" }),
  });

  const resumesQuery = useQuery({
    queryKey: ["resumes", { keyword: resumeKeyword, candidateId: resumeCandidateId, language: resumeLanguage }],
    queryFn: () =>
      listResumes({
        page: 1,
        pageSize: 50,
        keyword: resumeKeyword || undefined,
        candidateId: toOptionalNumber(resumeCandidateId),
        language: resumeLanguage || undefined,
      }),
  });

  const addFiles = (files: FileList | File[]) => {
    setFormError(null);
    const incomingFiles = Array.from(files);
    setSelectedFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...current];
      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push(file);
        }
      });
      return next;
    });
  };

  const removeFile = (fileToRemove: File) => {
    setSelectedFiles((current) => current.filter((file) => file !== fileToRemove));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setSelectedJobId("");
    setCandidateId("");
    setLanguage("zh-CN");
    setSource("manual_upload");
    setStatus("submitted");
    setRawText("");
    setRemark("");
    setFormError(null);
    setUploadedResults([]);
  };

  const submitUploads = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setUploadedResults([]);

    const jobId = toRequiredNumber(selectedJobId);
    if (!jobId) {
      setFormError("Please select a target job.");
      return;
    }
    if (selectedFiles.length === 0) {
      setFormError("Please choose at least one resume file.");
      return;
    }

    const parsedCandidateId = toOptionalNumber(candidateId);
    setIsSubmitting(true);

    try {
      const results: UploadedFileResult[] = [];
      for (const file of selectedFiles) {
        const resume = await uploadResume({
          file,
          candidateId: parsedCandidateId,
          rawText,
          language,
        });
        const resumeId = getResumeId(resume);
        if (!resumeId) {
          throw new Error("Resume upload succeeded but no resume ID was returned.");
        }

        await createApplication({
          jobId,
          resumeId,
          candidateId: parsedCandidateId,
          source: source.trim() || undefined,
          status: status.trim() || undefined,
          remark: remark.trim() || undefined,
        });

        results.push({ fileName: file.name, resumeId });
        setUploadedResults([...results]);
      }
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (error) {
      setFormError(getErrorMessage(error, error instanceof Error ? error.message : "Failed to upload resume."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Resume Upload</h1>
        <p className="text-sm text-gray-600 md:text-base">Upload resumes and create application records for jobs.</p>
      </div>

      <form onSubmit={submitUploads} className="mb-8 max-w-5xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Target Job</span>
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={jobsQuery.isLoading || isSubmitting}
              >
                <option value="">Choose a published job...</option>
                {jobsQuery.data?.items.map((job) => (
                  <option key={String(job.id)} value={String(job.id)}>
                    {job.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Candidate ID</span>
              <input
                type="number"
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Language</span>
              <input
                type="text"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="zh-CN"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Source</span>
              <input
                type="text"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="manual_upload"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Resume Files</h2>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <Upload className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="mb-2 text-base font-medium text-gray-900">Drop files here or click to upload</h3>
            <p className="mb-4 text-sm text-gray-500">PDF, DOC, and DOCX files are supported.</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              disabled={isSubmitting}
            >
              Choose Files
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-5 space-y-2">
              {selectedFiles.map((file) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <File className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(file)} className="rounded-lg p-1 hover:bg-gray-200" disabled={isSubmitting}>
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Application Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="submitted">submitted</option>
                <option value="screening">screening</option>
                <option value="shortlisted">shortlisted</option>
                <option value="rejected">rejected</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Remark</span>
              <input
                type="text"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="Optional note for this application"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Raw Text</span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Optional resume text if you want to store extracted content with the upload."
              rows={4}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </label>
        </section>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {uploadedResults.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle className="h-4 w-4" />
              Uploaded and submitted
            </div>
            <div className="space-y-1 text-sm text-emerald-700">
              {uploadedResults.map((result) => (
                <p key={`${result.fileName}-${result.resumeId}`}>
                  {result.fileName} · Resume #{result.resumeId}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={resetForm} className="rounded-lg px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-100" disabled={isSubmitting}>
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedJobId || selectedFiles.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            Upload and Create Applications
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Resume Library</h2>
          <p className="text-sm text-gray-600">Browse uploaded resume records.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <SearchBox
              value={resumeKeywordInput}
              placeholder="Search filename, text, or candidate..."
              onChange={setResumeKeywordInput}
              onSubmit={() => setResumeKeyword(resumeKeywordInput.trim())}
            />
            <input
              type="number"
              value={resumeCandidateId}
              onChange={(event) => setResumeCandidateId(event.target.value)}
              placeholder="Candidate ID"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={resumeLanguage}
              onChange={(event) => setResumeLanguage(event.target.value)}
              placeholder="Language"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setResumeKeyword(resumeKeywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
              Search
            </button>
          </div>
        </div>

        <QueryState loading={resumesQuery.isLoading} error={resumesQuery.error} fallback="Failed to load resumes." />
        {!resumesQuery.isLoading && !resumesQuery.isError && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
              Total {resumesQuery.data?.total ?? 0} resumes
            </div>
            <div className="divide-y divide-gray-200">
              {(resumesQuery.data?.items ?? []).map((resume) => (
                <div key={String(resume.id ?? resume.resumeId)} className="p-4 transition-colors hover:bg-gray-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <File className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-gray-900">{getResumeFilename(resume)}</h3>
                        <div className="mt-2 grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                          <span>ID: {String(resume.id ?? resume.resumeId ?? "-")}</span>
                          <span>Candidate: {resume.candidateName ?? resume.candidateId ?? "-"}</span>
                          <span>Language: {resume.language || "-"}</span>
                          <span>Size: {formatFileSize(resume.fileSize)}</span>
                        </div>
                        {resume.rawText && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{resume.rawText}</p>}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {resume.uploadedAt ?? resume.createdAt ?? "-"}
                    </div>
                  </div>
                </div>
              ))}
              {(resumesQuery.data?.items ?? []).length === 0 && <EmptyState label="No resumes found." />}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SearchBox({
  value,
  placeholder,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
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
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        {getErrorMessage(error, fallback)}
      </div>
    );
  }

  return null;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{label}</div>;
}
