import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, LoaderCircle } from "lucide-react";
import { getScreeningTask, type RequirementMatchStatus, type ScreeningRequirement, type ScreeningTaskDetail } from "../../api";
import { isRequestError } from "../../request";

type StatusStyle = {
  label: string;
  badge: string;
  card: string;
  mark: string;
};

const STATUS_STYLES: Record<"pass" | "partial" | "miss", StatusStyle> = {
  pass: {
    label: "满足",
    badge: "bg-green-100 text-green-700",
    card: "border-green-200",
    mark: "bg-green-100 shadow-[inset_0_-2px_0_#22c55e]",
  },
  partial: {
    label: "部分满足",
    badge: "bg-yellow-100 text-yellow-700",
    card: "border-yellow-200",
    mark: "bg-yellow-100 shadow-[inset_0_-2px_0_#eab308]",
  },
  miss: {
    label: "缺失",
    badge: "bg-red-100 text-red-600",
    card: "border-red-200",
    mark: "bg-red-100 shadow-[inset_0_-2px_0_#ef4444]",
  },
};

function normalizeStatus(status: RequirementMatchStatus | undefined): "pass" | "partial" | "miss" {
  if (status === "pass" || status === "partial" || status === "miss") {
    return status;
  }
  return "miss";
}

function getRequirementKey(requirement: ScreeningRequirement, index: number): string {
  return String(requirement.id ?? `req-${index}`);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return "text-gray-500";
  }
  return score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
}

function formatLabel(value: string | null | undefined): string {
  return value ? value.replaceAll("_", " ") : "-";
}

type Segment = {
  text: string;
  reqKey: string | null;
  status: "pass" | "partial" | "miss" | null;
};

/**
 * Split resumeText into segments, marking the spans that match requirement evidence.
 * Resolves each evidence to a [start, end) range using explicit offsets when provided,
 * otherwise the first verbatim occurrence of the snippet. Overlaps: the earlier mark wins.
 */
function buildSegments(resumeText: string, requirements: ScreeningRequirement[]): Segment[] {
  type Mark = { start: number; end: number; reqKey: string; status: "pass" | "partial" | "miss" };
  const marks: Mark[] = [];

  requirements.forEach((requirement, index) => {
    const reqKey = getRequirementKey(requirement, index);
    const status = normalizeStatus(requirement.status);
    (requirement.evidence ?? []).forEach((evidence) => {
      const snippet = evidence.text?.trim();
      let start = typeof evidence.start === "number" ? evidence.start : -1;
      let end = typeof evidence.end === "number" ? evidence.end : -1;

      if ((start < 0 || end <= start) && snippet) {
        const found = resumeText.indexOf(snippet);
        if (found >= 0) {
          start = found;
          end = found + snippet.length;
        }
      }

      if (start >= 0 && end > start && end <= resumeText.length) {
        marks.push({ start, end, reqKey, status });
      }
    });
  });

  if (marks.length === 0) {
    return [{ text: resumeText, reqKey: null, status: null }];
  }

  marks.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor) {
      // Overlaps a previous mark; skip to keep segmentation simple.
      continue;
    }
    if (mark.start > cursor) {
      segments.push({ text: resumeText.slice(cursor, mark.start), reqKey: null, status: null });
    }
    segments.push({ text: resumeText.slice(mark.start, mark.end), reqKey: mark.reqKey, status: mark.status });
    cursor = mark.end;
  }
  if (cursor < resumeText.length) {
    segments.push({ text: resumeText.slice(cursor), reqKey: null, status: null });
  }
  return segments;
}

export default function ScreeningDetailPage() {
  const { id } = useParams();
  const [activeReqKey, setActiveReqKey] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["screening-task", id],
    queryFn: () => getScreeningTask(id as string),
    enabled: Boolean(id),
  });

  const detail = detailQuery.data;
  const requirements = detail?.requirements ?? [];
  const resumeText = detail?.resumeText ?? "";
  const hasVisualization = requirements.length > 0 && resumeText.trim().length > 0;

  const segments = useMemo(
    () => (hasVisualization ? buildSegments(resumeText, requirements) : []),
    [hasVisualization, resumeText, requirements],
  );

  const counts = useMemo(() => {
    const result = { pass: 0, partial: 0, miss: 0 };
    requirements.forEach((requirement) => {
      result[normalizeStatus(requirement.status)] += 1;
    });
    return result;
  }, [requirements]);

  const focusRequirement = (reqKey: string) => {
    setActiveReqKey(reqKey);
    const target = document.getElementById(`evidence-${reqKey}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading screening detail...
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <BackLink />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {isRequestError(detailQuery.error) ? detailQuery.error.message : "Failed to load screening detail."}
        </div>
      </div>
    );
  }

  const candidateName = detail.candidateName ?? detail.candidate ?? `Resume #${detail.resumeId ?? "-"}`;
  const position = detail.position ?? detail.jobTitle ?? `Job #${detail.jobId ?? "-"}`;
  const score = detail.aiScore ?? detail.score;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <BackLink />

      <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-medium text-white">
            {getInitials(candidateName)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{candidateName}</h1>
            <p className="text-sm text-gray-500">{position}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400">AI 匹配度</div>
            <div className="flex items-baseline justify-end gap-1">
              <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score ?? "-"}</span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
          </div>
          {detail.recommendation && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
              {formatLabel(detail.recommendation)}
            </span>
          )}
        </div>
      </header>

      {hasVisualization ? (
        <>
          <Legend />
          <main className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
            <ResumePanel
              segments={segments}
              markCount={requirements.reduce((sum, req) => sum + (req.evidence?.length ?? 0), 0)}
              activeReqKey={activeReqKey}
              onMarkClick={focusRequirement}
            />
            <RequirementPanel
              requirements={requirements}
              counts={counts}
              summary={detail.summary}
              activeReqKey={activeReqKey}
              onCardClick={focusRequirement}
            />
          </main>
        </>
      ) : (
        <FallbackPanel detail={detail} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/screening" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" />
      Back to Results
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
      <span>原文标注：</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-5 rounded-sm bg-green-100 shadow-[inset_0_-2px_0_#22c55e]" /> 满足
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-5 rounded-sm bg-yellow-100 shadow-[inset_0_-2px_0_#eab308]" /> 部分满足
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-5 rounded-sm bg-red-100 shadow-[inset_0_-2px_0_#ef4444]" /> 缺失/不符
      </span>
      <span className="text-gray-400">点击右侧要求 → 左侧自动定位高亮</span>
    </div>
  );
}

function ResumePanel({
  segments,
  markCount,
  activeReqKey,
  onMarkClick,
}: {
  segments: Segment[];
  markCount: number;
  activeReqKey: string | null;
  onMarkClick: (reqKey: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">候选人简历原文</h2>
        <span className="text-xs text-gray-400">命中 {markCount} 处</span>
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto whitespace-pre-wrap p-6 text-[13px] leading-7 text-gray-700">
        {segments.map((segment, index) => {
          if (!segment.reqKey || !segment.status) {
            return <span key={index}>{segment.text}</span>;
          }
          const style = STATUS_STYLES[segment.status];
          const isActive = activeReqKey === segment.reqKey;
          return (
            <mark
              key={index}
              id={`evidence-${segment.reqKey}`}
              onClick={() => onMarkClick(segment.reqKey as string)}
              className={`cursor-pointer rounded-sm px-0.5 text-gray-800 ${style.mark} ${isActive ? "outline-2 outline-blue-500" : ""}`}
            >
              {segment.text}
            </mark>
          );
        })}
      </div>
    </section>
  );
}

function RequirementPanel({
  requirements,
  counts,
  summary,
  activeReqKey,
  onCardClick,
}: {
  requirements: ScreeningRequirement[];
  counts: { pass: number; partial: number; miss: number };
  summary: string | null | undefined;
  activeReqKey: string | null;
  onCardClick: (reqKey: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">岗位要求比对</h2>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>满足 <b className="text-green-600">{counts.pass}</b></span>
          <span>部分 <b className="text-yellow-600">{counts.partial}</b></span>
          <span>缺失 <b className="text-red-500">{counts.miss}</b></span>
        </div>
      </div>

      <div className="space-y-2.5">
        {requirements.map((requirement, index) => {
          const reqKey = getRequirementKey(requirement, index);
          const status = normalizeStatus(requirement.status);
          const style = STATUS_STYLES[status];
          const hasEvidence = (requirement.evidence?.length ?? 0) > 0;
          const isActive = activeReqKey === reqKey;
          const firstEvidence = requirement.evidence?.[0]?.text;
          return (
            <div
              key={reqKey}
              onClick={() => hasEvidence && onCardClick(reqKey)}
              className={`rounded-xl border bg-white p-4 transition ${style.card} ${
                hasEvidence ? "cursor-pointer hover:-translate-x-0.5" : ""
              } ${isActive ? "outline-2 outline-blue-500" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{requirement.label}</p>
                  {firstEvidence && (
                    <p className="mt-1 text-xs text-gray-500">证据：「{firstEvidence}」{requirement.comment ? ` · ${requirement.comment}` : ""}</p>
                  )}
                  {!firstEvidence && (
                    <p className="mt-1 text-xs text-gray-400">{requirement.comment || "简历中未找到对应描述"}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>{style.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {summary && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <h3 className="mb-1.5 text-sm font-semibold text-gray-700">AI 总评</h3>
          <p className="text-xs leading-6 text-gray-600">{summary}</p>
        </div>
      )}
    </section>
  );
}

function FallbackPanel({ detail }: { detail: ScreeningTaskDetail }) {
  const recConfig =
    detail.recommendation === "Pass"
      ? { icon: CheckCircle, color: "text-green-700", bg: "bg-green-100" }
      : detail.recommendation === "Review"
        ? { icon: AlertTriangle, color: "text-yellow-700", bg: "bg-yellow-100" }
        : { icon: XCircle, color: "text-red-700", bg: "bg-red-100" };
  const RecIcon = recConfig.icon;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        暂无可视化比对数据（缺少简历原文或结构化要求），展示文本结果。
      </div>
      {detail.summary && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Resume Summary</h2>
          <p className="text-gray-700">{detail.summary}</p>
        </div>
      )}
      {detail.markdownReport && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">AI Report</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{detail.markdownReport}</pre>
        </div>
      )}
      {detail.recommendation && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${recConfig.bg}`}>
          <RecIcon className={`h-5 w-5 ${recConfig.color}`} />
          <span className={`font-medium ${recConfig.color}`}>{formatLabel(detail.recommendation)}</span>
        </div>
      )}
    </div>
  );
}
