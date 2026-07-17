import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Clock, CheckCircle, XCircle, TrendingUp, Calendar, LoaderCircle } from "lucide-react";
import { getDashboardSummary, listScreeningTasks, type ScreeningTask } from "../../api";
import { isRequestError } from "../../request";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 60;

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback;
}

function isPollingStatus(status: string | undefined): boolean {
  return status === "queued" || status === "running" || status === "pending";
}

function getStatusLabel(status: string): string {
  if (status === "queued" || status === "pending") {
    return "排队中";
  }
  if (status === "running") {
    return "筛选中";
  }
  if (status === "success") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }
  return status;
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

export default function DashboardPage() {
  const screeningPollRef = useRef({ attempts: 0, dataUpdatedAt: 0 });

  const dashboardSummaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
  });

  const screeningTasksQuery = useQuery({
    queryKey: ["screening-tasks", "recent"],
    queryFn: () => listScreeningTasks({ page: 1, pageSize: 10, status: "all" }),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const shouldPoll = items.some((task) => isPollingStatus(task.status));

      if (!shouldPoll) {
        screeningPollRef.current = { attempts: 0, dataUpdatedAt: query.state.dataUpdatedAt };
        return false;
      }

      if (query.state.dataUpdatedAt > 0 && query.state.dataUpdatedAt !== screeningPollRef.current.dataUpdatedAt) {
        screeningPollRef.current = {
          attempts: screeningPollRef.current.attempts + 1,
          dataUpdatedAt: query.state.dataUpdatedAt,
        };
      }

      return screeningPollRef.current.attempts >= MAX_POLL_ATTEMPTS ? false : POLL_INTERVAL_MS;
    },
  });

  const summary = dashboardSummaryQuery.data;
  const stats = [
    { label: "Total Resumes", value: summary?.totalResumes, change: "+12.5%", trend: "up", icon: Users, color: "blue" },
    { label: "Pending Screening", value: summary?.pendingScreening, change: "-5.2%", trend: "down", icon: Clock, color: "yellow" },
    { label: "Recommended", value: summary?.recommended, change: "+18.3%", trend: "up", icon: CheckCircle, color: "green" },
    { label: "Rejected", value: summary?.rejected, change: "+8.1%", trend: "up", icon: XCircle, color: "red" },
  ] as const;

  const recentScreenings = screeningTasksQuery.data?.items ?? [];
  const totalScreeningTasks = screeningTasksQuery.data?.total ?? 0;

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) {
      return "text-gray-600 bg-gray-100";
    }
    return score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  };

  const getStatusColor = (status: string) => {
    if (status === "success") {
      return "text-green-700 bg-green-100";
    }
    if (status === "queued" || status === "pending") {
      return "text-yellow-700 bg-yellow-100";
    }
    if (status === "running") {
      return "text-blue-700 bg-blue-100";
    }
    if (status === "failed") {
      return "text-red-700 bg-red-100";
    }
    return "text-gray-700 bg-gray-100";
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Dashboard Overview</h1>
        <p className="text-sm text-gray-600 md:text-base">Welcome back! Here&apos;s what&apos;s happening with your recruitment.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mb-8 md:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = { blue: { bg: "bg-blue-50", text: "text-blue-600" }, yellow: { bg: "bg-yellow-50", text: "text-yellow-600" }, green: { bg: "bg-green-50", text: "text-green-600" }, red: { bg: "bg-red-50", text: "text-red-600" } }[stat.color];
          return (
            <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses.bg}`}>
                  <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className={`h-4 w-4 ${stat.trend === "up" ? "text-green-600" : "rotate-180 text-red-600"}`} />
                  <span className={stat.trend === "up" ? "text-green-600" : "text-red-600"}>{stat.change}</span>
                </div>
              </div>
              <h3 className="mb-1 text-3xl font-semibold text-gray-900">
                {dashboardSummaryQuery.isLoading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : stat.value?.toLocaleString() ?? "-"}
              </h3>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {dashboardSummaryQuery.isError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 md:mb-8">
          {getErrorMessage(dashboardSummaryQuery.error, "Failed to load dashboard summary.")}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 md:text-lg">Recent Screening Tasks</h2>
              <p className="mt-1 text-xs text-gray-500 md:text-sm">Total {totalScreeningTasks} tasks</p>
            </div>
            <Link to="/screening" className="text-xs font-medium text-blue-600 hover:text-blue-700 md:text-sm">View All</Link>
          </div>
        </div>
        {screeningTasksQuery.isLoading && (
          <div className="p-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading recent screening tasks...
            </div>
          </div>
        )}
        {screeningTasksQuery.isError && (
          <div className="p-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {getErrorMessage(screeningTasksQuery.error, "Failed to load recent screening tasks.")}
            </div>
          </div>
        )}
        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && recentScreenings.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">No screening tasks found.</div>
        )}
        <div className="hidden overflow-x-auto md:block">
          {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && recentScreenings.length > 0 && (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {["Candidate", "Position", "AI Score", "Status", "Date"].map((head) => (
                    <th key={head} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentScreenings.map((screening) => (
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
                    <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(screening.aiScore)}`}>{screening.aiScore ?? "-"}{screening.aiScore !== null && screening.aiScore !== undefined ? "%" : ""}</span></td>
                    <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}>{getStatusLabel(screening.status)}</span></td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"><div className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatTaskDate(screening.date ?? screening.createdAt)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && recentScreenings.length > 0 && (
          <div className="divide-y divide-gray-200 md:hidden">
            {recentScreenings.map((screening) => (
              <div key={String(screening.id)} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{getCandidateName(screening)}</p>
                    <p className="mt-1 truncate text-sm text-gray-600">{getPosition(screening)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}>{getStatusLabel(screening.status)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(screening.aiScore)}`}>{screening.aiScore ?? "-"}{screening.aiScore !== null && screening.aiScore !== undefined ? "%" : ""}</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatTaskDate(screening.date ?? screening.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
