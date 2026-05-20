import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, FileText, LoaderCircle, Search } from "lucide-react";
import { listApplications, type Application } from "../../api";
import { isRequestError } from "../../request";

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

function getStatusStyle(status: string): string {
  if (status === "shortlisted") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (status === "screening") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function getResumeName(application: Application): string {
  return application.resumeName ?? application.resumeFilename ?? `Resume #${application.resumeId}`;
}

export default function ScreeningPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [jobId, setJobId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  const applicationsQuery = useQuery({
    queryKey: ["applications", { keyword, jobId, candidateId, resumeId, status, source }],
    queryFn: () =>
      listApplications({
        page: 1,
        pageSize: 50,
        keyword: keyword || undefined,
        jobId: toOptionalNumber(jobId),
        candidateId: toOptionalNumber(candidateId),
        resumeId: toOptionalNumber(resumeId),
        status: status || undefined,
        source: source || undefined,
      }),
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Application Records</h1>
        <p className="text-sm text-gray-600 md:text-base">Review submitted resumes by job, candidate, status, and source.</p>
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_130px_150px_130px_160px_150px_auto]">
          <SearchBox value={keywordInput} placeholder="Search job, candidate, or resume..." onChange={setKeywordInput} onSubmit={() => setKeyword(keywordInput.trim())} />
          <input
            type="number"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Job ID"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            placeholder="Candidate ID"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={resumeId}
            onChange={(event) => setResumeId(event.target.value)}
            placeholder="Resume ID"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="submitted">submitted</option>
            <option value="screening">screening</option>
            <option value="shortlisted">shortlisted</option>
            <option value="rejected">rejected</option>
          </select>
          <input
            type="text"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Source"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={() => setKeyword(keywordInput.trim())} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
            Search
          </button>
        </div>
      </section>

      <QueryState loading={applicationsQuery.isLoading} error={applicationsQuery.error} fallback="Failed to load application records." />
      {!applicationsQuery.isLoading && !applicationsQuery.isError && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-500">
            Total {applicationsQuery.data?.total ?? 0} applications
          </div>
          <div className="divide-y divide-gray-200">
            {(applicationsQuery.data?.items ?? []).map((application) => (
              <div key={String(application.id)} className="p-4 transition-colors hover:bg-gray-50 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900">{application.candidateName ?? `Candidate #${application.candidateId ?? "-"}`}</h3>
                      <StatusBadge value={application.status} />
                      {application.source && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{application.source}</span>}
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Briefcase className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{application.jobTitle ?? `Job #${application.jobId}`}</span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{getResumeName(application)}</span>
                      </span>
                      <span>Candidate ID: {application.candidateId ?? "-"}</span>
                      <span>Created: {application.createdAt ?? "-"}</span>
                    </div>
                    {application.remark && <p className="mt-3 line-clamp-2 text-sm text-gray-600">{application.remark}</p>}
                  </div>
                  <div className="text-sm text-gray-500">#{String(application.id)}</div>
                </div>
              </div>
            ))}
            {(applicationsQuery.data?.items ?? []).length === 0 && <EmptyState label="No application records found." />}
          </div>
        </section>
      )}
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
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(value)}`}>{value}</span>;
}
