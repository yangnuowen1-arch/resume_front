import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  ExternalLink,
  FileText,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import {
  getScreeningTask,
  type RequirementMatchStatus,
  type ScreeningRequirement,
  type ScreeningTaskDetail
} from '../../api'
import { isRequestError } from '../../request'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type RequirementStatus = 'pass' | 'partial' | 'miss'
type MobilePanel = 'resume' | 'report'
type PdfStatus = 'loading' | 'ready' | 'error'

type TextRange = {
  start: number
  end: number
}

type EvidenceTarget = {
  requirementKey: string
  evidenceIndex: number
  status: RequirementStatus
  text: string
}

type EvidenceMatchSummary = {
  totalEvidenceCount: number
  matchedEvidenceCount: number
  unmatchedEvidenceCount: number
  matchedRequirementKeys: ReadonlySet<string>
  isComplete: boolean
  documentUrl: string | null
}

type PdfFocusRequest = {
  requirementKey: string
  requestId: number
  documentUrl: string
}

type IndexedTextSpan = TextRange & {
  element: HTMLSpanElement
}

type PdfPageTextIndex = {
  pageNumber: number
  text: string
  spans: IndexedTextSpan[]
}

type StatusStyle = {
  label: string
  badge: string
  mark: string
  row: string
  icon: string
}

const STATUS_STYLES: Record<RequirementStatus, StatusStyle> = {
  pass: {
    label: '匹配',
    badge: 'bg-emerald-100 text-emerald-700',
    mark: 'bg-emerald-100 shadow-[inset_0_-2px_0_#22c55e]',
    row: 'border-l-emerald-500',
    icon: 'text-emerald-600'
  },
  partial: {
    label: '部分匹配',
    badge: 'bg-amber-100 text-amber-700',
    mark: 'bg-amber-100 shadow-[inset_0_-2px_0_#eab308]',
    row: 'border-l-amber-500',
    icon: 'text-amber-600'
  },
  miss: {
    label: '未匹配',
    badge: 'bg-rose-100 text-rose-700',
    mark: 'bg-rose-100 shadow-[inset_0_-2px_0_#ef4444]',
    row: 'border-l-rose-500',
    icon: 'text-rose-600'
  }
}

const EMPTY_REQUIREMENTS: ScreeningRequirement[] = []
const EMPTY_TEXT_ITEMS: string[] = []
const PDF_RENDER_SCALE = 1.15
const MAX_CANVAS_PIXEL_RATIO = 2

function normalizeStatus(
  status: RequirementMatchStatus | undefined
): RequirementStatus {
  if (status === 'pass' || status === 'partial' || status === 'miss') {
    return status
  }
  return 'miss'
}

function getRequirementKey(
  requirement: ScreeningRequirement,
  index: number
): string {
  return String(requirement.id ?? `req-${index}`)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

function formatLabel(value: string | null | undefined): string {
  return value ? value.replaceAll('_', ' ') : '—'
}

function getScoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return {
      card: 'border-slate-200 bg-slate-50',
      label: 'text-slate-500',
      value: 'text-slate-700'
    }
  }
  if (score >= 80) {
    return {
      card: 'border-emerald-100 bg-emerald-50',
      label: 'text-emerald-600',
      value: 'text-emerald-600'
    }
  }
  if (score >= 60) {
    return {
      card: 'border-amber-100 bg-amber-50',
      label: 'text-amber-600',
      value: 'text-amber-600'
    }
  }
  return {
    card: 'border-rose-100 bg-rose-50',
    label: 'text-rose-500',
    value: 'text-rose-600'
  }
}

function getRecommendationTone(recommendation: string | null | undefined) {
  const value = recommendation?.toLowerCase() ?? ''
  if (/reject|fail|decline|拒绝|不通过/.test(value)) {
    return 'bg-rose-100 text-rose-700'
  }
  if (/review|pending|人工|复核|待定/.test(value)) {
    return 'bg-amber-100 text-amber-700'
  }
  if (/pass|accept|interview|recommend|通过|面试/.test(value)) {
    return 'bg-emerald-100 text-emerald-700'
  }
  return 'bg-slate-100 text-slate-600'
}

function getRecommendationLabel(recommendation: string | null | undefined) {
  const value = recommendation?.toLowerCase() ?? ''
  if (/reject|fail|decline|拒绝|不通过/.test(value)) {
    return '建议不通过'
  }
  if (/review|pending|人工|复核|待定/.test(value)) {
    return '建议人工复核'
  }
  if (/pass|accept|interview|recommend|通过|面试/.test(value)) {
    return '建议进入面试'
  }
  return formatLabel(recommendation)
}

type Segment = {
  text: string
  reqKey: string | null
  status: RequirementStatus | null
  anchorId?: string
}

type TextResumeBuildResult = {
  segments: Segment[]
  evidenceSummary: EvidenceMatchSummary
}

type NormalizedText = {
  text: string
  sourceRanges: TextRange[]
}

function createEvidenceMatchSummary(
  evidenceTargets: EvidenceTarget[],
  matchedTargetIndexes: ReadonlySet<number> = new Set<number>(),
  isComplete = true,
  documentUrl: string | null = null
): EvidenceMatchSummary {
  const matchedRequirementKeys = new Set<string>()

  matchedTargetIndexes.forEach((targetIndex) => {
    const target = evidenceTargets[targetIndex]
    if (target) {
      matchedRequirementKeys.add(target.requirementKey)
    }
  })

  return {
    totalEvidenceCount: evidenceTargets.length,
    matchedEvidenceCount: matchedTargetIndexes.size,
    unmatchedEvidenceCount: isComplete
      ? evidenceTargets.length - matchedTargetIndexes.size
      : 0,
    matchedRequirementKeys,
    isComplete,
    documentUrl
  }
}

function collectEvidenceTargets(
  requirements: ScreeningRequirement[]
): EvidenceTarget[] {
  const evidenceTargets: EvidenceTarget[] = []

  requirements.forEach((requirement, requirementIndex) => {
    const requirementKey = getRequirementKey(requirement, requirementIndex)
    const status = normalizeStatus(requirement.status)

    ;(requirement.evidence ?? []).forEach((evidence, evidenceIndex) => {
      const text = typeof evidence.text === 'string' ? evidence.text : ''

      evidenceTargets.push({
        requirementKey,
        evidenceIndex,
        status,
        text
      })
    })
  })

  return evidenceTargets
}

function isNormalizableWhitespace(character: string): boolean {
  return (
    character === ' ' ||
    character === '\n' ||
    character === '\r' ||
    character === '\u00a0'
  )
}

function normalizeWhitespaceForSearch(value: string): NormalizedText {
  const characters: string[] = []
  const sourceRanges: TextRange[] = []
  let index = 0

  while (index < value.length) {
    const start = index
    const character = value[index]

    if (isNormalizableWhitespace(character)) {
      while (
        index < value.length &&
        isNormalizableWhitespace(value[index])
      ) {
        index += 1
      }
      characters.push(' ')
      sourceRanges.push({ start, end: index })
      continue
    }

    characters.push(character)
    sourceRanges.push({ start, end: start + 1 })
    index += 1
  }

  return {
    text: characters.join(''),
    sourceRanges
  }
}

/**
 * Finds an evidence snippet without changing punctuation or attempting a fuzzy
 * match. The fallback only normalizes spaces, line breaks, and NBSPs.
 */
function findEvidenceRange(
  sourceText: string,
  evidenceText: string
): TextRange | null {
  if (!sourceText || !evidenceText) {
    return null
  }

  const exactStart = sourceText.indexOf(evidenceText)
  if (exactStart >= 0) {
    return {
      start: exactStart,
      end: exactStart + evidenceText.length
    }
  }

  const normalizedSource = normalizeWhitespaceForSearch(sourceText)
  const normalizedEvidence = normalizeWhitespaceForSearch(evidenceText)
  if (!normalizedEvidence.text) {
    return null
  }

  const normalizedStart = normalizedSource.text.indexOf(normalizedEvidence.text)
  if (normalizedStart < 0) {
    return null
  }

  const normalizedEnd = normalizedStart + normalizedEvidence.text.length
  return {
    start: normalizedSource.sourceRanges[normalizedStart].start,
    end: normalizedSource.sourceRanges[normalizedEnd - 1].end
  }
}

/**
 * Splits the text preview into normal text and matched evidence spans. The API no
 * longer supplies offsets, so evidence.text is the sole source of positions.
 */
function buildSegments(
  resumeText: string,
  requirements: ScreeningRequirement[]
): TextResumeBuildResult {
  type Mark = {
    start: number
    end: number
    reqKey: string
    status: RequirementStatus
    targetIndex: number
  }

  const evidenceTargets = collectEvidenceTargets(requirements)
  const marks: Mark[] = []

  evidenceTargets.forEach((target, targetIndex) => {
    const range = findEvidenceRange(resumeText, target.text)
    if (range) {
      marks.push({
        ...range,
        reqKey: target.requirementKey,
        status: target.status,
        targetIndex
      })
    }
  })

  if (marks.length === 0) {
    return {
      segments: [{ text: resumeText, reqKey: null, status: null }],
      evidenceSummary: createEvidenceMatchSummary(
        evidenceTargets,
        new Set<number>()
      )
    }
  }

  marks.sort((a, b) => a.start - b.start || b.end - a.end)

  const segments: Segment[] = []
  const anchoredRequirements = new Set<string>()
  const matchedTargetIndexes = new Set<number>()
  let cursor = 0

  for (const mark of marks) {
    if (mark.start < cursor) {
      continue
    }
    if (mark.start > cursor) {
      segments.push({
        text: resumeText.slice(cursor, mark.start),
        reqKey: null,
        status: null
      })
    }

    const anchorId = anchoredRequirements.has(mark.reqKey)
      ? undefined
      : `evidence-${mark.reqKey}`
    anchoredRequirements.add(mark.reqKey)
    segments.push({
      text: resumeText.slice(mark.start, mark.end),
      reqKey: mark.reqKey,
      status: mark.status,
      anchorId
    })
    matchedTargetIndexes.add(mark.targetIndex)
    cursor = mark.end
  }

  if (cursor < resumeText.length) {
    segments.push({
      text: resumeText.slice(cursor),
      reqKey: null,
      status: null
    })
  }

  return {
    segments,
    evidenceSummary: createEvidenceMatchSummary(
      evidenceTargets,
      matchedTargetIndexes
    )
  }
}

function getRequirementDetail(requirement: ScreeningRequirement): string {
  const evidence = requirement.evidence?.[0]?.text?.trim()
  const comment = requirement.comment?.trim()
  if (evidence && comment) {
    return `「${evidence}」 · ${comment}`
  }
  if (evidence) {
    return `「${evidence}」`
  }
  return comment || '暂无补充说明'
}

function getRequirementCandidateState(
  requirement: ScreeningRequirement
): string {
  return (
    requirement.candidateSituation?.trim() ||
    requirement.evidence?.[0]?.text?.trim() ||
    requirement.comment?.trim() ||
    '未发现相关信息'
  )
}

function formatYearsOfExperience(
  years: number | null | undefined
): string | null {
  if (years === null || years === undefined) {
    return null
  }
  return `${years} 年`
}

function isPdfResumeFile(
  url: string | null,
  fileType: string | null | undefined,
  filename: string | null | undefined,
  allowLegacyUrlFallback: boolean
): boolean {
  if (!url) {
    return false
  }

  const normalizedFileType = fileType?.trim().toLowerCase() ?? ''
  if (normalizedFileType.includes('pdf')) {
    return true
  }

  const hasPdfExtension = (value: string | null | undefined) =>
    /\.pdf(?:$|[?#])/i.test(value ?? '')

  if (hasPdfExtension(filename) || hasPdfExtension(url)) {
    return true
  }

  // Older top-level responses have no file metadata at all. Keep their prior
  // PDF-preview behavior, but do not mistake a new section's signed DOCX URL
  // (often application/octet-stream) for a PDF.
  return allowLegacyUrlFallback && normalizedFileType.length === 0
}

function getPdfErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'PDF 加载失败，请稍后重试。'
}

function isRenderingCancelled(error: unknown): boolean {
  return error instanceof pdfjsLib.RenderingCancelledException
}

export default function ScreeningDetailPage() {
  const { id } = useParams()

  return (
    <ScreeningDetailWorkspace
      key={id ?? 'screening-detail'}
      id={id}
    />
  )
}

function ScreeningDetailWorkspace({ id }: { id: string | undefined }) {
  const resumePanelRef = useRef<HTMLElement>(null)
  const [activeReqKey, setActiveReqKey] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('resume')
  const [zoom, setZoom] = useState(1)
  const [pdfEvidenceSummary, setPdfEvidenceSummary] =
    useState<EvidenceMatchSummary>(() =>
      createEvidenceMatchSummary([], new Set<number>(), false)
    )
  const [pdfFocusRequest, setPdfFocusRequest] =
    useState<PdfFocusRequest | null>(null)

  const detailQuery = useQuery({
    queryKey: ['screening-task', id],
    queryFn: () => getScreeningTask(id as string),
    enabled: Boolean(id)
  })

  const detail = detailQuery.data
  const sections = detail?.sections
  const candidateInfo = sections?.candidateInfo
  const assessment = sections?.assessment
  const requirementsComparison = sections?.requirementsComparison
  const candidateAnalysis = sections?.candidateAnalysis
  const finalRecommendation = sections?.finalRecommendation
  const fallback = sections?.fallback
  const requirements =
    requirementsComparison?.items ?? detail?.requirements ?? EMPTY_REQUIREMENTS
  const resumeSection = sections?.resume
  const resumeText = resumeSection?.text ?? detail?.resumeText ?? ''
  const resumeUrl =
    resumeSection?.previewUrl?.trim() ||
    resumeSection?.fileUrl?.trim() ||
    detail?.resumePreviewUrl?.trim() ||
    detail?.resumeFileUrl?.trim() ||
    null
  const hasResumeSectionFileMetadata = Boolean(
    resumeSection?.previewUrl ||
      resumeSection?.fileUrl ||
      resumeSection?.filename ||
      resumeSection?.fileType
  )
  const isPdfResume = isPdfResumeFile(
    resumeUrl,
    resumeSection?.fileType,
    resumeSection?.filename,
    !hasResumeSectionFileMetadata
  )
  const pdfUrl = isPdfResume ? resumeUrl : null
  const summaryText = sections?.summary?.text ?? detail?.summary
  const recommendation =
    finalRecommendation?.recommendation ??
    assessment?.recommendation ??
    detail?.recommendation
  const matchLevel = assessment?.matchLevel ?? detail?.matchLevel
  const taskStatus = candidateInfo?.taskStatus ?? detail?.status
  const taskErrorMessage =
    candidateInfo?.taskErrorMessage ?? detail?.errorMessage
  const finalRecommendationText =
    finalRecommendation?.text ?? summaryText ?? detail?.summary
  const markdownReport = fallback?.markdownReport ?? detail?.markdownReport
  const shouldUseMarkdownFallback =
    fallback?.shouldUseMarkdownFallback ??
    (Boolean(markdownReport) && requirements.length === 0)

  const textResumeResult = useMemo(
    () => {
      if (resumeText.trim()) {
        return buildSegments(resumeText, requirements)
      }

      return {
        segments: [],
        evidenceSummary: createEvidenceMatchSummary(
          collectEvidenceTargets(requirements),
          new Set<number>()
        )
      }
    },
    [resumeText, requirements]
  )
  const segments = textResumeResult.segments
  const pdfEvidenceTargets = useMemo(
    () => collectEvidenceTargets(requirements),
    [requirements]
  )
  const pendingPdfEvidenceSummary = useMemo(
    () =>
      createEvidenceMatchSummary(
        pdfEvidenceTargets,
        new Set<number>(),
        false,
        pdfUrl
      ),
    [pdfEvidenceTargets, pdfUrl]
  )

  const handlePdfEvidenceSummaryChange = useCallback(
    (summary: EvidenceMatchSummary) => {
      setPdfEvidenceSummary(summary)
    },
    []
  )

  const evidenceSummary = isPdfResume
    ? pdfEvidenceSummary.documentUrl === pdfUrl
      ? pdfEvidenceSummary
      : pendingPdfEvidenceSummary
    : textResumeResult.evidenceSummary

  const resolvedRequirementKeys = useMemo(() => {
    return new Set(evidenceSummary.matchedRequirementKeys)
  }, [evidenceSummary])

  const matchingRequirements = useMemo(
    () => {
      if (requirementsComparison?.matchedItems?.length) {
        return requirementsComparison.matchedItems
      }
      return requirements
        .filter((requirement) => normalizeStatus(requirement.status) === 'pass')
        .slice(0, 3)
    },
    [requirements, requirementsComparison]
  )

  const attentionRequirements = useMemo(
    () => {
      if (requirementsComparison?.attentionItems?.length) {
        return requirementsComparison.attentionItems
      }
      return requirements
        .filter((requirement) => normalizeStatus(requirement.status) !== 'pass')
        .slice(0, 3)
    },
    [requirements, requirementsComparison]
  )

  const focusRequirement = useCallback((reqKey: string) => {
    setActiveReqKey(reqKey)
    setMobilePanel('resume')

    if (isPdfResume) {
      setPdfFocusRequest((current) => ({
        requirementKey: reqKey,
        requestId: (current?.requestId ?? 0) + 1,
        documentUrl: pdfUrl ?? ''
      }))
      return
    }

    window.setTimeout(() => {
      document
        .getElementById(`evidence-${reqKey}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }, [isPdfResume, pdfUrl])

  const handleEvidenceClick = useCallback((reqKey: string) => {
    setActiveReqKey(reqKey)
    setMobilePanel('report')
    window.setTimeout(() => {
      document
        .getElementById(`requirement-${reqKey}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }, [])

  const adjustZoom = (change: number) => {
    setZoom((value) => Math.min(1.4, Math.max(0.65, value + change)))
  }

  const toggleFullscreen = () => {
    const panel = resumePanelRef.current
    if (!panel) {
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void panel.requestFullscreen?.()
  }

  if (detailQuery.isLoading) {
    return (
      <div className='flex h-full items-center justify-center gap-2 bg-slate-50 text-sm text-slate-600'>
        <LoaderCircle className='h-4 w-4 animate-spin' />
        正在加载筛选详情…
      </div>
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className='p-4 md:p-6 lg:p-8'>
        <Link
          to='/screening'
          className='mb-4 inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900'
        >
          <ArrowLeft className='h-4 w-4' />
          返回筛选列表
        </Link>
        <div className='rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
          {isRequestError(detailQuery.error)
            ? detailQuery.error.message
            : '加载筛选详情失败。'}
        </div>
      </div>
    )
  }

  const candidateName =
    candidateInfo?.name ??
    detail.candidateName ??
    detail.candidate ??
    `Resume #${detail.resumeId ?? '—'}`
  const position =
    candidateInfo?.appliedPosition ??
    detail.position ??
    detail.jobTitle ??
    `Job #${detail.jobId ?? '—'}`
  const score = assessment?.score ?? detail.aiScore ?? detail.score
  const scoreTone = getScoreTone(score)
  return (
    <div className='flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-800 lg:h-full'>
      <header className='shrink-0 border-b border-slate-200 bg-white px-4 py-3 lg:px-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3 sm:gap-4'>
            <Link
              to='/screening'
              className='inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900'
            >
              <ArrowLeft className='h-4 w-4' />
              <span className='hidden sm:inline'>返回列表</span>
            </Link>
            <div className='hidden h-5 w-px bg-slate-200 sm:block' />
            <div className='flex min-w-0 items-center gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm'>
                {getInitials(candidateName)}
              </div>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='truncate text-base font-bold text-slate-900 lg:text-lg'>
                    {candidateName}
                  </h1>
                  <span className='max-w-40 truncate rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'>
                    {position}
                  </span>
                </div>
                <p className='mt-0.5 truncate text-xs text-slate-500'>
                  投递岗位：{position}
                </p>
              </div>
            </div>
          </div>

          <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${scoreTone.card}`}
            >
              <span className={`text-xs font-medium ${scoreTone.label}`}>
                AI 匹配度
              </span>
              <div className='flex items-baseline'>
                <span
                  className={`text-xl font-black lg:text-2xl ${scoreTone.value}`}
                >
                  {score ?? '—'}
                </span>
                <span
                  className={`ml-0.5 text-[10px] font-semibold ${scoreTone.label}`}
                >
                  /100
                </span>
              </div>
            </div>
            {recommendation && (
              <span
                className={`hidden rounded-lg px-3 py-2 text-xs font-semibold sm:inline-flex ${getRecommendationTone(recommendation)}`}
              >
                {getRecommendationLabel(recommendation)}
              </span>
            )}
          </div>
        </div>
      </header>

      <nav className='grid shrink-0 grid-cols-2 border-b border-slate-200 bg-white text-sm font-semibold lg:hidden'>
        <button
          type='button'
          onClick={() => setMobilePanel('resume')}
          className={`flex items-center justify-center gap-2 border-b-2 px-3 py-3 transition ${
            mobilePanel === 'resume'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className='h-4 w-4' />
          查看简历原文
        </button>
        <button
          type='button'
          onClick={() => setMobilePanel('report')}
          className={`flex items-center justify-center gap-2 border-b-2 px-3 py-3 transition ${
            mobilePanel === 'report'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BrainCircuit className='h-4 w-4' />
          AI 深度评估
        </button>
      </nav>

      <main className='flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row'>
        <ResumeViewer
          panelRef={resumePanelRef}
          visibleOnMobile={mobilePanel === 'resume'}
          candidateName={candidateName}
          position={position}
          email={detail.email}
          phone={detail.phone}
          location={detail.location}
          pdfUrl={pdfUrl}
          requirements={requirements}
          segments={segments}
          hasResume={resumeText.trim().length > 0}
          evidenceSummary={evidenceSummary}
          activeReqKey={activeReqKey}
          pdfFocusRequest={
            pdfFocusRequest?.documentUrl === pdfUrl ? pdfFocusRequest : null
          }
          zoom={zoom}
          onAdjustZoom={adjustZoom}
          onResetZoom={() => setZoom(1)}
          onToggleFullscreen={toggleFullscreen}
          onEvidenceClick={handleEvidenceClick}
          onPdfEvidenceSummaryChange={handlePdfEvidenceSummaryChange}
        />
        <ReportPanel
          visibleOnMobile={mobilePanel === 'report'}
          detail={detail}
          candidateName={candidateName}
          position={position}
          score={score}
          matchLevel={matchLevel}
          recommendation={recommendation}
          summaryText={summaryText}
          finalRecommendationText={finalRecommendationText}
          markdownReport={markdownReport}
          shouldUseMarkdownFallback={shouldUseMarkdownFallback}
          currentTitle={candidateInfo?.currentTitle}
          yearsOfExperience={candidateInfo?.yearsOfExperience}
          highestEducation={candidateInfo?.highestEducation}
          taskStatus={taskStatus}
          taskErrorMessage={taskErrorMessage}
          strengths={candidateAnalysis?.strengths ?? EMPTY_TEXT_ITEMS}
          weaknesses={candidateAnalysis?.weaknesses ?? EMPTY_TEXT_ITEMS}
          risks={candidateAnalysis?.risks ?? EMPTY_TEXT_ITEMS}
          suggestedInterviewQuestions={
            candidateAnalysis?.suggestedInterviewQuestions ?? EMPTY_TEXT_ITEMS
          }
          requirements={requirements}
          matchingRequirements={matchingRequirements}
          attentionRequirements={attentionRequirements}
          resolvedRequirementKeys={resolvedRequirementKeys}
          activeReqKey={activeReqKey}
          onRequirementClick={focusRequirement}
        />
      </main>
    </div>
  )
}

const ResumeViewer = ({
  panelRef,
  visibleOnMobile,
  candidateName,
  position,
  email,
  phone,
  location,
  pdfUrl,
  requirements,
  segments,
  hasResume,
  evidenceSummary,
  activeReqKey,
  pdfFocusRequest,
  zoom,
  onAdjustZoom,
  onResetZoom,
  onToggleFullscreen,
  onEvidenceClick,
  onPdfEvidenceSummaryChange
}: {
  panelRef: RefObject<HTMLElement | null>
  visibleOnMobile: boolean
  candidateName: string
  position: string
  email: string | null | undefined
  phone: string | null | undefined
  location: string | null | undefined
  pdfUrl: string | null
  requirements: ScreeningRequirement[]
  segments: Segment[]
  hasResume: boolean
  evidenceSummary: EvidenceMatchSummary
  activeReqKey: string | null
  pdfFocusRequest: PdfFocusRequest | null
  zoom: number
  onAdjustZoom: (change: number) => void
  onResetZoom: () => void
  onToggleFullscreen: () => void
  onEvidenceClick: (reqKey: string) => void
  onPdfEvidenceSummaryChange: (summary: EvidenceMatchSummary) => void
}) => {
  return (
    <section
      ref={panelRef}
      className={`${visibleOnMobile ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col overflow-hidden border-r border-slate-200 bg-slate-100 lg:flex lg:w-[45%] lg:flex-none`}
    >
      <div className='flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold text-slate-700'>简历原文</span>
          <span className='rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500'>
            {pdfUrl ? 'PDF 预览' : '文本预览'}
          </span>
          {evidenceSummary.totalEvidenceCount > 0 && (
            <span className='hidden text-slate-400 sm:inline'>
              {pdfUrl && !evidenceSummary.isComplete
                ? '正在建立文本索引…'
                : `已标注 ${evidenceSummary.matchedEvidenceCount} 处证据`}
              {evidenceSummary.isComplete &&
                evidenceSummary.unmatchedEvidenceCount > 0 &&
                `，${evidenceSummary.unmatchedEvidenceCount} 处未定位`}
            </span>
          )}
        </div>
        <div className='flex items-center gap-1'>
          <div className='flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5'>
            <button
              type='button'
              aria-label='缩小简历'
              title='缩小'
              onClick={() => onAdjustZoom(-0.1)}
              className='rounded p-1 transition hover:bg-white hover:shadow-sm'
            >
              <Minus className='h-4 w-4' />
            </button>
            <span className='w-10 text-center font-mono font-medium text-slate-600'>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type='button'
              aria-label='放大简历'
              title='放大'
              onClick={() => onAdjustZoom(0.1)}
              className='rounded p-1 transition hover:bg-white hover:shadow-sm'
            >
              <Plus className='h-4 w-4' />
            </button>
            <button
              type='button'
              aria-label='重置缩放'
              title='重置比例'
              onClick={onResetZoom}
              className='rounded p-1 transition hover:bg-white hover:shadow-sm'
            >
              <RotateCcw className='h-3.5 w-3.5' />
            </button>
          </div>
          <button
            type='button'
            aria-label='全屏查看简历'
            title='全屏查看'
            onClick={onToggleFullscreen}
            className='rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition hover:bg-slate-200'
          >
            <Maximize2 className='h-3.5 w-3.5' />
          </button>
        </div>
      </div>

      {!pdfUrl && (
        <div className='flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500'>
          <span>原文标注：</span>
          <LegendItem
            className='bg-emerald-100 shadow-[inset_0_-2px_0_#22c55e]'
            label='匹配'
          />
          <LegendItem
            className='bg-amber-100 shadow-[inset_0_-2px_0_#eab308]'
            label='部分匹配'
          />
          <LegendItem
            className='bg-rose-100 shadow-[inset_0_-2px_0_#ef4444]'
            label='未匹配'
          />
        </div>
      )}

      <div className='flex-1 overflow-auto p-4 lg:p-6'>
        {pdfUrl ? (
          <PdfResumeDocument
            key={pdfUrl}
            url={pdfUrl}
            zoom={zoom}
            requirements={requirements}
            activeReqKey={activeReqKey}
            focusRequest={pdfFocusRequest}
            onEvidenceClick={onEvidenceClick}
            onMatchSummaryChange={onPdfEvidenceSummaryChange}
          />
        ) : (
          <article
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center'
            }}
            className='mx-auto min-h-[42rem] w-full max-w-2xl rounded-sm border border-slate-300 bg-white p-6 text-slate-800 shadow-lg transition-transform duration-200 sm:p-8'
          >
          <div className='mb-5 border-b-2 border-indigo-600 pb-5'>
            <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-start'>
              <div>
                <h2 className='text-2xl font-bold tracking-tight text-slate-900'>
                  {candidateName}
                </h2>
                <p className='mt-1 text-sm font-semibold text-indigo-600'>
                  {position}
                </p>
              </div>
              {(email || phone || location) && (
                <div className='space-y-1 text-left text-xs text-slate-500 sm:text-right'>
                  {email && <p>{email}</p>}
                  {phone && <p>{phone}</p>}
                  {location && <p>{location}</p>}
                </div>
              )}
            </div>
          </div>

          {hasResume ? (
            <div className='whitespace-pre-wrap text-[13px] leading-7 text-slate-700'>
              {segments.map((segment, index) => {
                if (!segment.reqKey || !segment.status) {
                  return <span key={index}>{segment.text}</span>
                }

                const style = STATUS_STYLES[segment.status]
                const isActive = activeReqKey === segment.reqKey
                return (
                  <mark
                    key={index}
                    id={segment.anchorId}
                    role='button'
                    tabIndex={0}
                    onClick={() => onEvidenceClick(segment.reqKey as string)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onEvidenceClick(segment.reqKey as string)
                      }
                    }}
                    aria-label={`查看“${segment.text}”对应的岗位要求`}
                    title='点击查看对应的岗位要求'
                    className={`cursor-pointer rounded-sm px-0.5 text-slate-800 transition ${style.mark} ${
                      isActive
                        ? 'outline-2 outline-offset-1 outline-indigo-500'
                        : 'hover:outline-1 hover:outline-indigo-300'
                    }`}
                  >
                    {segment.text}
                  </mark>
                )
              })}
            </div>
          ) : (
            <div className='flex min-h-80 flex-col items-center justify-center text-center'>
              <FileText className='h-10 w-10 text-slate-300' />
              <p className='mt-3 text-sm font-medium text-slate-600'>
                暂无简历原文
              </p>
              <p className='mt-1 max-w-sm text-xs leading-5 text-slate-400'>
                原始简历文本返回后，系统会在这里展示对应证据和高亮标注。
              </p>
            </div>
          )}
          </article>
        )}
      </div>
    </section>
  )
}

function buildPdfPageTextIndex(
  pageNumber: number,
  textLayerElement: HTMLDivElement
): PdfPageTextIndex {
  const spans: IndexedTextSpan[] = []
  let text = ''

  // TextLayer emits text spans and line-break <br>s as direct children when
  // marked content is disabled. Keeping line breaks lets the whitespace-only
  // fallback match snippets that cross visual lines.
  Array.from(textLayerElement.children).forEach((element) => {
    if (element instanceof HTMLSpanElement) {
      const spanText = element.textContent ?? ''
      const start = text.length
      text += spanText
      spans.push({ element, start, end: text.length })
      return
    }

    if (element instanceof HTMLBRElement) {
      text += '\n'
    }
  })

  return { pageNumber, text, spans }
}

function getSpansForRange(
  pageTextIndex: PdfPageTextIndex,
  range: TextRange
): HTMLSpanElement[] {
  return pageTextIndex.spans
    .filter((span) => span.start < range.end && span.end > range.start)
    .map((span) => span.element)
}

function updatePdfEvidenceActiveState(
  spanRequirementKeys: ReadonlyMap<HTMLSpanElement, ReadonlySet<string>>,
  activeReqKey: string | null
) {
  spanRequirementKeys.forEach((requirementKeys, span) => {
    span.classList.toggle(
      'pdf-evidence-active',
      Boolean(activeReqKey && requirementKeys.has(activeReqKey))
    )
  })
}

function PdfResumeDocument({
  url,
  zoom,
  requirements,
  activeReqKey,
  focusRequest,
  onEvidenceClick,
  onMatchSummaryChange
}: {
  url: string
  zoom: number
  requirements: ScreeningRequirement[]
  activeReqKey: string | null
  focusRequest: PdfFocusRequest | null
  onEvidenceClick: (reqKey: string) => void
  onMatchSummaryChange: (summary: EvidenceMatchSummary) => void
}) {
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const textLayerRefs = useRef(new Map<number, HTMLDivElement>())
  const pageTextIndexesRef = useRef(new Map<number, PdfPageTextIndex>())
  const spanRequirementKeysRef = useRef(
    new Map<HTMLSpanElement, Set<string>>()
  )
  const requirementHitSpansRef = useRef(
    new Map<string, Set<HTMLSpanElement>>()
  )
  const interactionCleanupRef = useRef<Array<() => void>>([])
  const activeReqKeyRef = useRef(activeReqKey)
  const requirementsRef = useRef(requirements)
  const onEvidenceClickRef = useRef(onEvidenceClick)
  const onMatchSummaryChangeRef = useRef(onMatchSummaryChange)
  const [status, setStatus] = useState<PdfStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [pageNumbers, setPageNumbers] = useState<number[]>([])
  const [isRendering, setIsRendering] = useState(false)
  const [textIndexVersion, setTextIndexVersion] = useState(0)

  const clearTextLayerState = useCallback(() => {
    interactionCleanupRef.current.forEach((cleanup) => cleanup())
    interactionCleanupRef.current = []
    pageTextIndexesRef.current.clear()
    spanRequirementKeysRef.current.clear()
    requirementHitSpansRef.current.clear()

    textLayerRefs.current.forEach((textLayerElement) => {
      textLayerElement.replaceChildren()
    })
  }, [])

  useEffect(() => {
    requirementsRef.current = requirements
  }, [requirements])

  useEffect(() => {
    onEvidenceClickRef.current = onEvidenceClick
  }, [onEvidenceClick])

  useEffect(() => {
    onMatchSummaryChangeRef.current = onMatchSummaryChange
  }, [onMatchSummaryChange])

  useEffect(() => {
    activeReqKeyRef.current = activeReqKey
    updatePdfEvidenceActiveState(
      spanRequirementKeysRef.current,
      activeReqKey
    )
  }, [activeReqKey])

  useEffect(() => {
    let isCancelled = false
    let loadedPdf: PDFDocumentProxy | null = null

    canvasRefs.current.clear()
    pageRefs.current.clear()
    clearTextLayerState()

    const loadingTask = pdfjsLib.getDocument({
      url,
      withCredentials: false
    })

    void loadingTask.promise
      .then((pdf) => {
        if (isCancelled) {
          void pdf.destroy()
          return
        }

        loadedPdf = pdf
        pdfRef.current = pdf
        setPageNumbers(
          Array.from({ length: pdf.numPages }, (_, index) => index + 1)
        )
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setStatus('error')
          setMessage(getPdfErrorMessage(error))
          onMatchSummaryChangeRef.current(
            createEvidenceMatchSummary(
              collectEvidenceTargets(requirementsRef.current),
              new Set<number>(),
              true,
              url
            )
          )
        }
      })

    return () => {
      isCancelled = true
      pdfRef.current = null

      if (loadedPdf) {
        void loadedPdf.destroy()
        return
      }

      void loadingTask.destroy()
    }
  }, [clearTextLayerState, url])

  useEffect(() => {
    const pdf = pdfRef.current
    if (status !== 'ready' || !pdf || pageNumbers.length === 0) {
      return
    }

    const activePdf = pdf
    const evidenceTargets = collectEvidenceTargets(requirements)
    let isCancelled = false
    const renderTasks: RenderTask[] = []
    const textLayers: pdfjsLib.TextLayer[] = []

    clearTextLayerState()
    onMatchSummaryChangeRef.current(
      createEvidenceMatchSummary(
        evidenceTargets,
        new Set<number>(),
        false,
        url
      )
    )

    const selectEvidenceFromSpan = (span: HTMLSpanElement) => {
      const requirementKeys = spanRequirementKeysRef.current.get(span)
      if (!requirementKeys || requirementKeys.size === 0) {
        return
      }

      const activeRequirementKey = activeReqKeyRef.current
      const requirementKey =
        activeRequirementKey && requirementKeys.has(activeRequirementKey)
          ? activeRequirementKey
          : requirementKeys.values().next().value

      if (requirementKey) {
        onEvidenceClickRef.current(requirementKey)
      }
    }

    const bindEvidenceInteractions = () => {
      textLayerRefs.current.forEach((textLayerElement) => {
        const getEvidenceSpan = (target: EventTarget | null) => {
          if (!(target instanceof Element)) {
            return null
          }

          const span = target.closest<HTMLSpanElement>(
            '.pdf-evidence-highlight'
          )
          return span && textLayerElement.contains(span) ? span : null
        }
        const handleClick = (event: MouseEvent) => {
          const span = getEvidenceSpan(event.target)
          if (span) {
            selectEvidenceFromSpan(span)
          }
        }
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }

          const span = getEvidenceSpan(event.target)
          if (span) {
            event.preventDefault()
            selectEvidenceFromSpan(span)
          }
        }

        textLayerElement.addEventListener('click', handleClick)
        textLayerElement.addEventListener('keydown', handleKeyDown)
        interactionCleanupRef.current.push(() => {
          textLayerElement.removeEventListener('click', handleClick)
          textLayerElement.removeEventListener('keydown', handleKeyDown)
        })
      })
    }

    const applyPdfEvidenceHighlights = (): EvidenceMatchSummary => {
      const matchedTargetIndexes = new Set<number>()
      const spanStatuses = new Map<HTMLSpanElement, Set<RequirementStatus>>()
      const pageTextIndexes = Array.from(
        pageTextIndexesRef.current.values()
      ).sort((a, b) => a.pageNumber - b.pageNumber)

      evidenceTargets.forEach((target, targetIndex) => {
        for (const pageTextIndex of pageTextIndexes) {
          const range = findEvidenceRange(pageTextIndex.text, target.text)
          if (!range) {
            continue
          }

          const matchingSpans = getSpansForRange(pageTextIndex, range)
          if (matchingSpans.length === 0) {
            continue
          }

          matchedTargetIndexes.add(targetIndex)
          matchingSpans.forEach((span) => {
            const requirementKeys =
              spanRequirementKeysRef.current.get(span) ?? new Set<string>()
            requirementKeys.add(target.requirementKey)
            spanRequirementKeysRef.current.set(span, requirementKeys)

            const statuses =
              spanStatuses.get(span) ?? new Set<RequirementStatus>()
            statuses.add(target.status)
            spanStatuses.set(span, statuses)

            const requirementHits =
              requirementHitSpansRef.current.get(target.requirementKey) ??
              new Set<HTMLSpanElement>()
            requirementHits.add(span)
            requirementHitSpansRef.current.set(
              target.requirementKey,
              requirementHits
            )
          })
          break
        }
      })

      spanRequirementKeysRef.current.forEach((requirementKeys, span) => {
        span.classList.add('pdf-evidence-highlight')
        spanStatuses.get(span)?.forEach((status) => {
          span.classList.add(`pdf-evidence-${status}`)
        })
        span.dataset.requirementKeys = Array.from(requirementKeys).join(',')
        span.setAttribute('role', 'button')
        span.tabIndex = 0
        span.title = '点击查看对应的岗位要求'
      })

      updatePdfEvidenceActiveState(
        spanRequirementKeysRef.current,
        activeReqKeyRef.current
      )
      return createEvidenceMatchSummary(
        evidenceTargets,
        matchedTargetIndexes,
        true,
        url
      )
    }

    async function renderPages() {
      setIsRendering(true)
      setMessage(null)

      try {
        for (const pageNumber of pageNumbers) {
          if (isCancelled) {
            return
          }

          const canvas = canvasRefs.current.get(pageNumber)
          const pageElement = pageRefs.current.get(pageNumber)
          const textLayerElement = textLayerRefs.current.get(pageNumber)
          if (!canvas || !pageElement || !textLayerElement) {
            continue
          }

          const page = await activePdf.getPage(pageNumber)
          if (isCancelled) {
            return
          }

          const viewport = page.getViewport({
            scale: PDF_RENDER_SCALE * zoom
          })
          const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            MAX_CANVAS_PIXEL_RATIO
          )
          const context = canvas.getContext('2d')

          if (!context) {
            throw new Error('无法创建 PDF 渲染画布。')
          }

          pageElement.style.width = `${viewport.width}px`
          pageElement.style.height = `${viewport.height}px`
          pageElement.style.setProperty('--scale-factor', String(viewport.scale))
          pageElement.style.setProperty('--user-unit', String(viewport.userUnit))
          pageElement.style.setProperty('--scale-round-x', '1px')
          pageElement.style.setProperty('--scale-round-y', '1px')
          pageElement.style.setProperty(
            '--total-scale-factor',
            String(viewport.scale * viewport.userUnit)
          )
          canvas.width = Math.floor(viewport.width * pixelRatio)
          canvas.height = Math.floor(viewport.height * pixelRatio)
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.clearRect(0, 0, canvas.width, canvas.height)
          textLayerElement.replaceChildren()

          const renderTask = page.render({
            canvas: null,
            canvasContext: context,
            viewport,
            transform:
              pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0]
          })

          renderTasks.push(renderTask)
          await renderTask.promise

          if (isCancelled) {
            return
          }

          try {
            const textContent = await page.getTextContent({
              disableNormalization: true
            })
            if (isCancelled) {
              return
            }

            const textLayer = new pdfjsLib.TextLayer({
              textContentSource: textContent,
              container: textLayerElement,
              viewport
            })
            textLayers.push(textLayer)
            await textLayer.render()

            if (isCancelled) {
              return
            }

            pageTextIndexesRef.current.set(
              pageNumber,
              buildPdfPageTextIndex(pageNumber, textLayerElement)
            )
          } catch {
            if (isCancelled) {
              return
            }

            // Text extraction failure means the evidence remains unmatched;
            // the already-rendered canvas should stay available.
            textLayerElement.replaceChildren()
          }
        }

        if (isCancelled) {
          return
        }

        const evidenceSummary = applyPdfEvidenceHighlights()
        bindEvidenceInteractions()
        onMatchSummaryChangeRef.current(evidenceSummary)
        setTextIndexVersion((version) => version + 1)
      } catch (error) {
        if (!isCancelled && !isRenderingCancelled(error)) {
          setStatus('error')
          setMessage(getPdfErrorMessage(error))
          onMatchSummaryChangeRef.current(
            createEvidenceMatchSummary(
              evidenceTargets,
              new Set<number>(),
              true,
              url
            )
          )
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false)
        }
      }
    }

    void renderPages()

    return () => {
      isCancelled = true
      renderTasks.forEach((task) => {
        try {
          task.cancel()
        } catch {
          // Ignore cancellation races between React cleanup and pdf.js render.
        }
      })
      textLayers.forEach((textLayer) => textLayer.cancel())
      clearTextLayerState()
    }
  }, [clearTextLayerState, pageNumbers, requirements, status, url, zoom])

  useEffect(() => {
    if (!focusRequest) {
      return
    }

    const firstHit = requirementHitSpansRef.current
      .get(focusRequest.requirementKey)
      ?.values()
      .next().value
    if (!firstHit) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      firstHit.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [focusRequest, textIndexVersion])

  if (status === 'error') {
    return (
      <div className='mx-auto flex min-h-[28rem] w-full max-w-2xl flex-col items-center justify-center rounded-sm border border-rose-200 bg-white p-8 text-center shadow-lg'>
        <AlertTriangle className='h-10 w-10 text-rose-400' />
        <p className='mt-3 text-sm font-semibold text-slate-700'>
          PDF 预览加载失败
        </p>
        <p className='mt-1 max-w-sm text-xs leading-5 text-slate-500'>
          {message || '当前简历文件无法预览。'}
        </p>
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className='mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50'
        >
          <ExternalLink className='h-3.5 w-3.5' />
          打开原文件
        </a>
      </div>
    )
  }

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col items-center gap-4'>
      {status === 'loading' && (
        <div className='flex min-h-[28rem] w-full max-w-2xl flex-col items-center justify-center rounded-sm border border-slate-300 bg-white text-center shadow-lg'>
          <LoaderCircle className='h-8 w-8 animate-spin text-indigo-500' />
          <p className='mt-3 text-sm font-medium text-slate-600'>
            正在加载 PDF 预览…
          </p>
        </div>
      )}

      {status === 'ready' && (
        <div className='flex w-full flex-col items-center gap-4'>
          <div className='flex w-full max-w-2xl items-center justify-between gap-3 text-xs text-slate-500'>
            <span>共 {pageNumbers.length} 页</span>
            {isRendering && (
              <span className='inline-flex items-center gap-1.5'>
                <LoaderCircle className='h-3.5 w-3.5 animate-spin' />
                正在渲染并建立文本索引
              </span>
            )}
          </div>
          {pageNumbers.map((pageNumber) => (
            <div
              key={pageNumber}
              className='max-w-full overflow-auto rounded-sm border border-slate-300 bg-white shadow-lg'
            >
              <div
                ref={(pageElement) => {
                  if (pageElement) {
                    pageRefs.current.set(pageNumber, pageElement)
                    return
                  }

                  pageRefs.current.delete(pageNumber)
                }}
                className='pdf-page'
              >
                <canvas
                  ref={(canvas) => {
                    if (canvas) {
                      canvasRefs.current.set(pageNumber, canvas)
                      return
                    }

                    canvasRefs.current.delete(pageNumber)
                  }}
                  aria-label={`PDF 第 ${pageNumber} 页`}
                  className='block bg-white'
                />
                <div
                  ref={(textLayerElement) => {
                    if (textLayerElement) {
                      textLayerRefs.current.set(pageNumber, textLayerElement)
                      return
                    }

                    textLayerRefs.current.delete(pageNumber)
                  }}
                  className='textLayer'
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LegendItem({
  className,
  label
}: {
  className: string
  label: string
}) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className={`inline-block h-3 w-5 rounded-sm ${className}`} />
      {label}
    </span>
  )
}

function ReportPanel({
  visibleOnMobile,
  detail,
  candidateName,
  position,
  score,
  matchLevel,
  recommendation,
  summaryText,
  finalRecommendationText,
  markdownReport,
  shouldUseMarkdownFallback,
  currentTitle,
  yearsOfExperience,
  highestEducation,
  taskStatus,
  taskErrorMessage,
  strengths,
  weaknesses,
  risks,
  suggestedInterviewQuestions,
  requirements,
  matchingRequirements,
  attentionRequirements,
  resolvedRequirementKeys,
  activeReqKey,
  onRequirementClick
}: {
  visibleOnMobile: boolean
  detail: ScreeningTaskDetail
  candidateName: string
  position: string
  score: number | null | undefined
  matchLevel: string | null | undefined
  recommendation: string | null | undefined
  summaryText: string | null | undefined
  finalRecommendationText: string | null | undefined
  markdownReport: string | null | undefined
  shouldUseMarkdownFallback: boolean
  currentTitle: string | null | undefined
  yearsOfExperience: number | null | undefined
  highestEducation: string | null | undefined
  taskStatus: string | null | undefined
  taskErrorMessage: string | null | undefined
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  suggestedInterviewQuestions: string[]
  requirements: ScreeningRequirement[]
  matchingRequirements: ScreeningRequirement[]
  attentionRequirements: ScreeningRequirement[]
  resolvedRequirementKeys: ReadonlySet<string>
  activeReqKey: string | null
  onRequirementClick: (reqKey: string) => void
}) {
  const scoreTone = getScoreTone(score)
  const yearsLabel = formatYearsOfExperience(yearsOfExperience)
  const concernItems = [...weaknesses, ...risks]
  const hasCandidateAnalysis =
    strengths.length > 0 ||
    weaknesses.length > 0 ||
    risks.length > 0 ||
    suggestedInterviewQuestions.length > 0

  return (
    <section
      className={`${visibleOnMobile ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col overflow-hidden bg-white lg:flex lg:w-[55%] lg:flex-none`}
    >
      <div className='flex-1 overflow-y-auto p-4 lg:p-6'>
        <div className='space-y-5'>
          <section className='relative overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/70 p-5'>
            <Sparkles className='absolute right-4 top-4 h-12 w-12 text-indigo-600 opacity-10' />
            <h2 className='flex items-center gap-2 text-sm font-bold text-indigo-900'>
              <span className='rounded bg-indigo-100 p-1 text-indigo-600'>
                <FileText className='h-4 w-4' />
              </span>
              简历摘要
            </h2>
            <p className='mt-3 max-w-4xl text-sm leading-6 text-slate-700'>
              {summaryText || '暂未返回 AI 简历摘要。'}
            </p>
          </section>

          <section>
            <div className='flex items-center justify-between gap-3 border-b border-slate-200 pb-2'>
              <h2 className='flex items-center gap-2 text-base font-bold text-slate-950'>
                <span className='rounded bg-rose-100 p-1 text-rose-600'>
                  <BrainCircuit className='h-4 w-4' />
                </span>
                AI 评估报告
              </h2>
              <span className='font-mono text-xs text-slate-400'>
                ID: {String(detail.screeningResultId ?? detail.id)}
              </span>
            </div>

            <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
              <section className='rounded-xl border border-slate-200 bg-slate-50/70 p-4'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-slate-400'>
                  候选人信息
                </h3>
                <dl className='mt-3 space-y-2 text-sm'>
                  <InfoLine
                    label='姓名'
                    value={candidateName}
                    emphasized
                  />
                  <InfoLine
                    label='应聘岗位'
                    value={position}
                    emphasized
                  />
                  {currentTitle && (
                    <InfoLine
                      label='当前职位'
                      value={currentTitle}
                    />
                  )}
                  {yearsLabel && (
                    <InfoLine
                      label='工作年限'
                      value={yearsLabel}
                    />
                  )}
                  {highestEducation && (
                    <InfoLine
                      label='最高学历'
                      value={highestEducation}
                    />
                  )}
                  {detail.email && (
                    <InfoLine
                      label='邮箱'
                      value={detail.email}
                    />
                  )}
                  {detail.phone && (
                    <InfoLine
                      label='电话'
                      value={detail.phone}
                    />
                  )}
                  {detail.location && (
                    <InfoLine
                      label='所在地'
                      value={detail.location}
                    />
                  )}
                  <InfoLine
                    label='任务状态'
                    value={formatLabel(taskStatus)}
                  />
                  {taskErrorMessage && (
                    <InfoLine
                      label='错误信息'
                      value={taskErrorMessage}
                      valueClassName='text-rose-600'
                    />
                  )}
                </dl>
              </section>

              <section className='rounded-xl border border-slate-200 bg-slate-50/70 p-4'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-slate-400'>
                  评估结论
                </h3>
                <dl className='mt-3 space-y-2 text-sm'>
                  <InfoLine
                    label='综合评分'
                    value={
                      score === null || score === undefined
                        ? '—'
                        : `${score} / 100`
                    }
                    valueClassName={scoreTone.value}
                    emphasized
                  />
                  <InfoLine
                    label='匹配等级'
                    value={formatLabel(matchLevel)}
                  />
                  <div className='flex items-center justify-between gap-3'>
                    <dt className='shrink-0 text-slate-400'>AI 建议</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getRecommendationTone(recommendation)}`}
                      >
                        {getRecommendationLabel(recommendation)}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>

          <section>
            <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-slate-400'>
              岗位需求对比分析
            </h3>
            <div className='overflow-x-auto rounded-xl border border-slate-200 shadow-sm'>
              <table className='w-max min-w-full whitespace-nowrap divide-y divide-slate-200 text-left text-xs sm:text-sm'>
                <thead className='bg-slate-50 text-slate-700'>
                  <tr>
                    <th className='px-4 py-3 font-bold'>招聘要求</th>
                    <th className='px-4 py-3 font-bold'>候选人实际情况</th>
                    <th className='px-4 py-3 font-bold'>匹配状态</th>
                    <th className='px-4 py-3 font-bold'>证据及备注</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white text-slate-600'>
                  {requirements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className='px-4 py-8 text-center text-sm text-slate-400'
                      >
                        暂无结构化岗位要求。
                      </td>
                    </tr>
                  ) : (
                    requirements.map((requirement, index) => {
                      const reqKey = getRequirementKey(requirement, index)
                      const status = normalizeStatus(requirement.status)
                      const style = STATUS_STYLES[status]
                      const hasEvidence = resolvedRequirementKeys.has(reqKey)
                      const isActive = activeReqKey === reqKey

                      return (
                        <tr
                          key={reqKey}
                          id={`requirement-${reqKey}`}
                          tabIndex={hasEvidence ? 0 : undefined}
                          onClick={() =>
                            hasEvidence && onRequirementClick(reqKey)
                          }
                          onKeyDown={(event) => {
                            if (
                              hasEvidence &&
                              (event.key === 'Enter' || event.key === ' ')
                            ) {
                              event.preventDefault()
                              onRequirementClick(reqKey)
                            }
                          }}
                          className={`border-l-2 transition ${style.row} ${
                            hasEvidence
                              ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:bg-indigo-50'
                              : ''
                          } ${
                            isActive
                              ? 'relative z-10 bg-indigo-50/70 outline-2 outline-indigo-500 outline-offset-[-2px]'
                              : ''
                          }`}
                        >
                          <td className='px-4 py-3 align-top font-bold text-slate-950'>
                            {requirement.label}
                          </td>
                          <td className='px-4 py-3 align-top'>
                            {getRequirementCandidateState(requirement)}
                          </td>
                          <td className='px-4 py-3 align-top'>
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold ${style.badge}`}
                            >
                              <StatusGlyph
                                status={status}
                                className={style.icon}
                              />
                              {style.label}
                            </span>
                          </td>
                          <td className='px-4 py-3 align-top text-slate-400'>
                            {getRequirementDetail(requirement)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {resolvedRequirementKeys.size > 0 && (
              <p className='mt-2 text-xs text-slate-400'>
                点击有证据的行，可在简历原文中定位对应标注。
              </p>
            )}
          </section>

          {(matchingRequirements.length > 0 ||
            attentionRequirements.length > 0) && (
            <section className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              {matchingRequirements.length > 0 && (
                <InsightCard
                  title='匹配亮点'
                  items={matchingRequirements}
                  variant='positive'
                />
              )}
              {attentionRequirements.length > 0 && (
                <InsightCard
                  title='重点关注'
                  items={attentionRequirements}
                  variant='attention'
                />
              )}
            </section>
          )}

          {hasCandidateAnalysis && (
            <section>
              <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-slate-400'>
                候选人优劣势分析
              </h3>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {strengths.length > 0 && (
                  <TextInsightCard
                    title='优势'
                    items={strengths}
                    variant='positive'
                  />
                )}
                {concernItems.length > 0 && (
                  <TextInsightCard
                    title='劣势与风险'
                    items={concernItems}
                    variant='risk'
                  />
                )}
                {suggestedInterviewQuestions.length > 0 && (
                  <TextInsightCard
                    title='建议面试问题'
                    items={suggestedInterviewQuestions}
                    variant='question'
                    ordered
                    className='md:col-span-2'
                  />
                )}
              </div>
            </section>
          )}

          {shouldUseMarkdownFallback && markdownReport && (
            <section className='rounded-xl border border-slate-200 bg-white p-5'>
              <h3 className='flex items-center gap-2 text-sm font-bold text-slate-800'>
                <FileText className='h-4 w-4 text-indigo-600' />
                AI 完整报告
              </h3>
              <pre className='mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700'>
                {markdownReport}
              </pre>
            </section>
          )}

          <section className='rounded-xl border border-slate-200 bg-slate-50 p-5'>
            <h3 className='text-xs font-bold uppercase tracking-wider text-slate-400'>
              最终筛选建议
            </h3>
            <p className='mt-2 text-sm leading-6 text-slate-700'>
              {finalRecommendationText ||
                '当前筛选结果已基于岗位要求与简历信息生成，建议结合业务团队的实际需求进行人工确认。'}
            </p>
            {recommendation && (
              <span
                className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRecommendationTone(recommendation)}`}
              >
                AI 建议：{getRecommendationLabel(recommendation)}
              </span>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

function InfoLine({
  label,
  value,
  valueClassName = 'text-slate-800',
  emphasized = false
}: {
  label: string
  value: string
  valueClassName?: string
  emphasized?: boolean
}) {
  return (
    <div className='flex items-start justify-between gap-3'>
      <dt className='shrink-0 text-slate-400'>{label}</dt>
      <dd
        className={`text-right ${valueClassName} ${
          emphasized ? 'font-semibold' : 'font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function StatusGlyph({
  status,
  className
}: {
  status: RequirementStatus
  className: string
}) {
  if (status === 'pass') {
    return <span className={`font-black ${className}`}>✓</span>
  }
  if (status === 'partial') {
    return <span className={`font-black ${className}`}>−</span>
  }
  return <span className={`font-black ${className}`}>×</span>
}

function InsightCard({
  title,
  items,
  variant
}: {
  title: string
  items: ScreeningRequirement[]
  variant: 'positive' | 'attention'
}) {
  const isPositive = variant === 'positive'
  const color = isPositive
    ? {
        card: 'border-emerald-100 bg-emerald-50/30',
        title: 'text-emerald-800',
        icon: 'bg-emerald-100 text-emerald-600',
        bullet: 'text-emerald-500'
      }
    : {
        card: 'border-rose-100 bg-rose-50/20',
        title: 'text-rose-800',
        icon: 'bg-rose-100 text-rose-600',
        bullet: 'text-rose-500'
      }

  return (
    <div className={`rounded-xl border p-5 ${color.card}`}>
      <h3
        className={`flex items-center gap-2 text-sm font-bold ${color.title}`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${color.icon}`}
        >
          {isPositive ? (
            <Sparkles className='h-3.5 w-3.5' />
          ) : (
            <AlertTriangle className='h-3.5 w-3.5' />
          )}
        </span>
        {title}
      </h3>
      <ul className='mt-3 space-y-2.5 text-sm leading-5 text-slate-700'>
        {items.map((requirement, index) => (
          <li
            key={getRequirementKey(requirement, index)}
            className='flex gap-2'
          >
            <span className={`font-bold ${color.bullet}`}>✦</span>
            <span>
              <strong>{requirement.label}：</strong>
              {getRequirementDetail(requirement)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TextInsightCard({
  title,
  items,
  variant,
  ordered = false,
  className = ''
}: {
  title: string
  items: string[]
  variant: 'positive' | 'risk' | 'question'
  ordered?: boolean
  className?: string
}) {
  const visibleItems = items.filter((item) => item.trim().length > 0)
  if (visibleItems.length === 0) {
    return null
  }

  const color =
    variant === 'positive'
      ? {
          card: 'border-emerald-100 bg-emerald-50/30',
          title: 'text-emerald-800',
          icon: 'bg-emerald-100 text-emerald-600',
          bullet: 'text-emerald-500'
        }
      : variant === 'risk'
        ? {
            card: 'border-rose-100 bg-rose-50/20',
            title: 'text-rose-800',
            icon: 'bg-rose-100 text-rose-600',
            bullet: 'text-rose-500'
          }
        : {
            card: 'border-indigo-100 bg-indigo-50/30',
            title: 'text-indigo-800',
            icon: 'bg-indigo-100 text-indigo-600',
            bullet: 'text-indigo-500'
          }

  return (
    <div className={`rounded-xl border p-5 ${color.card} ${className}`}>
      <h3
        className={`flex items-center gap-2 text-sm font-bold ${color.title}`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${color.icon}`}
        >
          {variant === 'positive' ? (
            <Sparkles className='h-3.5 w-3.5' />
          ) : variant === 'risk' ? (
            <AlertTriangle className='h-3.5 w-3.5' />
          ) : (
            <BrainCircuit className='h-3.5 w-3.5' />
          )}
        </span>
        {title}
      </h3>
      {ordered ? (
        <ol className='mt-3 space-y-2.5 text-sm leading-5 text-slate-700'>
          {visibleItems.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className='flex gap-2'
            >
              <span className={`font-bold ${color.bullet}`}>
                {index + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className='mt-3 space-y-2.5 text-sm leading-5 text-slate-700'>
          {visibleItems.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className='flex gap-2'
            >
              <span className={`font-bold ${color.bullet}`}>✦</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
