import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { listScreeningTasks, type ScreeningTask } from "../../api";
import { isRequestError } from "../../request";

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function getCandidateName(screening: ScreeningTask): string {
  return screening.candidate ?? screening.candidateName ?? `Candidate #${screening.candidateId ?? "-"}`;
}

function getPosition(screening: ScreeningTask): string {
  return screening.position ?? screening.jobTitle ?? `Job #${screening.jobId ?? "-"}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function formatTaskDate(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return "text-gray-600 bg-gray-100";
  }
  return score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
}

function getStatusColor(status: string): string {
  if (status === "success") {
    return "text-green-700 bg-green-100";
  }
  if (status === "pending") {
    return "text-yellow-700 bg-yellow-100";
  }
  if (status === "failed") {
    return "text-red-700 bg-red-100";
  }
  return "text-gray-700 bg-gray-100";
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? "-" : `${score}%`;
}

export default function ScreeningPage() {
  const [page, setPage] = useState(1);

  const screeningTasksQuery = useQuery({
    queryKey: ["screening-tasks", { page, pageSize: PAGE_SIZE }],
    queryFn: () => listScreeningTasks({ page, pageSize: PAGE_SIZE }),
  });

  const screeningTasks = screeningTasksQuery.data?.items ?? [];
  const total = screeningTasksQuery.data?.total ?? 0;
  const currentPage = screeningTasksQuery.data?.page ?? page;
  const totalPages = screeningTasksQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Screening Tasks</h1>
        <p className="text-sm text-gray-600 md:text-base">Review AI screening task results by candidate and position.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 md:text-lg">Screening Tasks</h2>
              <p className="mt-1 text-xs text-gray-500 md:text-sm">Total {total} tasks</p>
            </div>
          </div>
        </div>

        <QueryState loading={screeningTasksQuery.isLoading} error={screeningTasksQuery.error} fallback="Failed to load screening tasks." />

        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && screeningTasks.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">No screening tasks found.</div>
        )}

        <div className="hidden overflow-x-auto md:block">
          {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && screeningTasks.length > 0 && (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {["Candidate", "Position", "AI Score", "Status", "Date"].map((head) => (
                    <th key={head} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {screeningTasks.map((screening) => (
                  <tr key={String(screening.id)} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                          <span className="text-xs font-medium text-white">{getInitials(getCandidateName(screening))}</span>
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-900">{getCandidateName(screening)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{getPosition(screening)}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(screening.aiScore)}`}>{formatScore(screening.aiScore)}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}>{screening.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatTaskDate(screening.date ?? screening.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && screeningTasks.length > 0 && (
          <div className="divide-y divide-gray-200 md:hidden">
            {screeningTasks.map((screening) => (
              <div key={String(screening.id)} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{getCandidateName(screening)}</p>
                    <p className="mt-1 truncate text-sm text-gray-600">{getPosition(screening)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}>{screening.status}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(screening.aiScore)}`}>{formatScore(screening.aiScore)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatTaskDate(screening.date ?? screening.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && (
          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}

function QueryState({ loading, error, fallback }: { loading: boolean; error: unknown; fallback: string }) {
  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading screening tasks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {getErrorMessage(error, fallback)}
        </div>
      </div>
    );
  }

  return null;
}

function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-24 text-center text-gray-700">
          Page {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
