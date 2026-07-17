import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  PlayCircle,
  Sparkles
} from 'lucide-react'
import {
  listJobs,
  listScreeningTasks,
  runScreeningTask,
  type RunScreeningTaskResponse,
  type ScreeningTask
} from '../../api'
import { isRequestError, queryClient } from '../../request'

const PAGE_SIZE = 20
const POLL_INTERVAL_MS = 2_000
const MAX_POLL_ATTEMPTS = 60

const OUTPUT_LANGUAGE_OPTIONS = [
  { value: 'Chinese', label: 'Chinese' },
  { value: 'English', label: 'English' }
]

function getErrorMessage(error: unknown, fallback: string): string {
  return isRequestError(error) ? error.message : fallback
}

function getCandidateName(screening: ScreeningTask): string {
  if (screening.candidate || screening.candidateName) {
    return screening.candidate ?? screening.candidateName ?? ''
  }
  return screening.resumeId !== undefined
    ? `Resume #${screening.resumeId}`
    : `Candidate #${screening.candidateId ?? '-'}`
}

function getPosition(screening: ScreeningTask): string {
  return (
    screening.position ?? screening.jobTitle ?? `Job #${screening.jobId ?? '-'}`
  )
}

function getTaskScore(screening: ScreeningTask): number | null | undefined {
  return screening.aiScore ?? screening.score
}

function getTaskKey(screening: ScreeningTask): string {
  return String(
    screening.id ??
      screening.screeningResultId ??
      `${screening.resumeId ?? '-'}-${screening.jobId ?? '-'}-${screening.createdAt ?? ''}`
  )
}

function getTaskId(screening: ScreeningTask): string {
  return String(screening.screeningResultId ?? screening.id)
}

function isSameTask(screening: ScreeningTask, taskId: string): boolean {
  return getTaskId(screening) === taskId || String(screening.id) === taskId
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

function formatTaskDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return 'text-gray-600 bg-gray-100'
  }
  return score >= 80
    ? 'text-green-600 bg-green-50'
    : score >= 60
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-red-600 bg-red-50'
}

function getStatusColor(status: string): string {
  if (status === 'success') {
    return 'text-green-700 bg-green-100'
  }
  if (status === 'queued' || status === 'pending') {
    return 'text-yellow-700 bg-yellow-100'
  }
  if (status === 'running') {
    return 'text-blue-700 bg-blue-100'
  }
  if (status === 'failed') {
    return 'text-red-700 bg-red-100'
  }
  return 'text-gray-700 bg-gray-100'
}

function getStatusLabel(status: string): string {
  if (status === 'queued' || status === 'pending') {
    return '排队中'
  }
  if (status === 'running') {
    return '筛选中'
  }
  if (status === 'success') {
    return '已完成'
  }
  if (status === 'failed') {
    return '失败'
  }
  return status
}

function isPollingStatus(status: string | undefined): boolean {
  return status === 'queued' || status === 'running' || status === 'pending'
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '-' : `${score}%`
}

function formatResultLabel(value: string | null | undefined): string {
  return value ? value.replaceAll('_', ' ') : '-'
}

function createSubmittedTask(result: RunScreeningTaskResponse): ScreeningTask {
  return {
    id: result.screeningResultId,
    screeningResultId: result.screeningResultId,
    applicationId: result.applicationId,
    resumeId: result.resumeId,
    jobId: result.jobId,
    status: result.status
  }
}

function getLatestTaskMessage(task: ScreeningTask): string {
  if (task.status === 'queued' || task.status === 'pending') {
    return '任务已提交，等待后台筛选。'
  }
  if (task.status === 'running') {
    return '筛选中，结果会通过任务状态轮询刷新。'
  }
  if (task.status === 'success') {
    return '筛选已完成，结果来自任务状态轮询。'
  }
  if (task.status === 'failed') {
    return task.errorMessage
      ? `筛选失败：${task.errorMessage}`
      : '筛选失败，请查看任务错误信息。'
  }
  return '任务状态已更新。'
}

export default function ScreeningPage() {
  const [page, setPage] = useState(1)
  const [resumeIdInput, setResumeIdInput] = useState('')
  const [jobId, setJobId] = useState('')
  const [outputLanguage, setOutputLanguage] = useState('Chinese')
  const [runFormError, setRunFormError] = useState<string | null>(null)
  const [latestTask, setLatestTask] = useState<ScreeningTask | null>(null)
  const screeningPollRef = useRef({ attempts: 0, dataUpdatedAt: 0 })

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'screening-run-options'],
    queryFn: () => listJobs({ page: 1, pageSize: 200 })
  })

  const screeningTasksQuery = useQuery({
    queryKey: ['screening-tasks', { page, pageSize: PAGE_SIZE }],
    queryFn: () =>
      listScreeningTasks({ page, pageSize: PAGE_SIZE, status: 'all' }),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const latestTaskId = latestTask ? getTaskId(latestTask) : null
      const latestTaskFromList = latestTaskId
        ? items.find((task) => isSameTask(task, latestTaskId))
        : undefined
      const latestTaskStatus = latestTaskFromList?.status ?? latestTask?.status
      const shouldPoll =
        items.some((task) => isPollingStatus(task.status)) ||
        isPollingStatus(latestTaskStatus)

      if (!shouldPoll) {
        screeningPollRef.current = {
          attempts: 0,
          dataUpdatedAt: query.state.dataUpdatedAt
        }
        return false
      }

      if (
        query.state.dataUpdatedAt > 0 &&
        query.state.dataUpdatedAt !== screeningPollRef.current.dataUpdatedAt
      ) {
        screeningPollRef.current = {
          attempts: screeningPollRef.current.attempts + 1,
          dataUpdatedAt: query.state.dataUpdatedAt
        }
      }

      return screeningPollRef.current.attempts >= MAX_POLL_ATTEMPTS
        ? false
        : POLL_INTERVAL_MS
    }
  })

  const runScreeningMutation = useMutation({
    mutationFn: runScreeningTask,
    onSuccess: (result) => {
      setRunFormError(null)
      setLatestTask(createSubmittedTask(result))
      screeningPollRef.current = { attempts: 0, dataUpdatedAt: 0 }
      setPage(1)
      void queryClient.invalidateQueries({ queryKey: ['screening-tasks'] })
    },
    onError: (error) => {
      setLatestTask(null)
      setRunFormError(getErrorMessage(error, 'Failed to run AI screening.'))
    }
  })

  const jobs = jobsQuery.data?.items ?? []
  const screeningTasks = screeningTasksQuery.data?.items ?? []
  const total = screeningTasksQuery.data?.total ?? 0
  const currentPage = screeningTasksQuery.data?.page ?? page
  const latestTaskId = latestTask ? getTaskId(latestTask) : null
  const refreshedLatestTask = latestTaskId
    ? screeningTasks.find((task) => isSameTask(task, latestTaskId))
    : undefined
  const visibleLatestTask = refreshedLatestTask
    ? {
        ...refreshedLatestTask,
        screeningResultId:
          refreshedLatestTask.screeningResultId ?? refreshedLatestTask.id
      }
    : latestTask
  const shouldShowSubmittedTask =
    latestTask !== null &&
    latestTaskId !== null &&
    currentPage === 1 &&
    !screeningTasks.some((task) => isSameTask(task, latestTaskId))
  const displayedScreeningTasks =
    shouldShowSubmittedTask && visibleLatestTask
      ? [visibleLatestTask, ...screeningTasks].slice(0, PAGE_SIZE)
      : screeningTasks
  const displayedTotal = shouldShowSubmittedTask ? total + 1 : total
  const totalPages = Math.max(
    screeningTasksQuery.data?.totalPages ?? 1,
    Math.max(1, Math.ceil(displayedTotal / PAGE_SIZE))
  )

  const submitRunScreening = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRunFormError(null)

    const resumeId = Number(resumeIdInput)
    const selectedJobId = Number(jobId)

    if (!Number.isInteger(resumeId) || resumeId <= 0) {
      setRunFormError('Enter a valid resume ID.')
      return
    }

    if (!Number.isInteger(selectedJobId) || selectedJobId <= 0) {
      setRunFormError('Select a job before running screening.')
      return
    }

    runScreeningMutation.mutate({
      resumeId,
      jobId: selectedJobId,
      outputLanguage
    })
  }

  const changePage = (nextPage: number) => {
    screeningPollRef.current = { attempts: 0, dataUpdatedAt: 0 }
    setPage(nextPage)
  }

  return (
    <div className='p-4 md:p-6 lg:p-8'>
      <div className='mb-6 md:mb-8'>
        <h1 className='mb-2 text-xl font-semibold text-gray-900 md:text-2xl'>
          Screening Tasks
        </h1>
        <p className='text-sm text-gray-600 md:text-base'>
          Run AI resume screening and review task results.
        </p>
      </div>

      <section className='mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6'>
        <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-base font-semibold text-gray-900 md:text-lg'>
              Run AI Screening
            </h2>
            <p className='mt-1 text-xs text-gray-500 md:text-sm'>
              Submit a parsed resume against a job.
            </p>
          </div>
          <Sparkles className='hidden h-5 w-5 text-blue-600 sm:block' />
        </div>

        <form
          onSubmit={submitRunScreening}
          className='grid gap-3 lg:grid-cols-[minmax(150px,180px)_minmax(0,1fr)_180px_auto]'
        >
          <label className='space-y-1 text-sm font-medium text-gray-700'>
            Resume ID
            <input
              type='number'
              min='1'
              value={resumeIdInput}
              onChange={(event) => setResumeIdInput(event.target.value)}
              placeholder='Resume ID'
              className='h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500'
            />
          </label>

          <label className='space-y-1 text-sm font-medium text-gray-700'>
            Job
            <select
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              disabled={jobsQuery.isLoading}
              className='h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
            >
              <option value=''>
                {jobsQuery.isLoading ? 'Loading jobs...' : 'Select a job'}
              </option>
              {jobs.map((job) => (
                <option
                  key={String(job.id)}
                  value={String(job.id)}
                >
                  {job.title}
                </option>
              ))}
            </select>
          </label>

          <label className='space-y-1 text-sm font-medium text-gray-700'>
            Output Language
            <select
              value={outputLanguage}
              onChange={(event) => setOutputLanguage(event.target.value)}
              className='h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal focus:border-transparent focus:ring-2 focus:ring-blue-500'
            >
              {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type='submit'
            disabled={runScreeningMutation.isPending || jobsQuery.isLoading}
            className='inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {runScreeningMutation.isPending ? (
              <LoaderCircle className='h-4 w-4 animate-spin' />
            ) : (
              <PlayCircle className='h-4 w-4' />
            )}
            Run
          </button>
        </form>

        {jobsQuery.isError && (
          <div className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {getErrorMessage(jobsQuery.error, 'Failed to load jobs.')}
          </div>
        )}

        {runFormError && (
          <div className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {runFormError}
          </div>
        )}

        {visibleLatestTask && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              visibleLatestTask.status === 'failed'
                ? 'border-red-200 bg-red-50'
                : visibleLatestTask.status === 'success'
                  ? 'border-green-200 bg-green-50'
                  : 'border-blue-200 bg-blue-50'
            }`}
          >
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div className='min-w-0'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  {visibleLatestTask.status === 'success' && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getScoreColor(getTaskScore(visibleLatestTask))}`}
                    >
                      {formatScore(getTaskScore(visibleLatestTask))}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(visibleLatestTask.status)}`}
                  >
                    {getStatusLabel(visibleLatestTask.status)}
                  </span>
                  {visibleLatestTask.status === 'success' && (
                    <span className='rounded-full bg-white px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200'>
                      {formatResultLabel(visibleLatestTask.recommendation)}
                    </span>
                  )}
                </div>
                <p className='text-sm font-medium text-gray-900'>
                  Screening task #
                  {visibleLatestTask.screeningResultId ?? visibleLatestTask.id}
                </p>
                <p className='mt-1 text-sm text-gray-700'>
                  {getLatestTaskMessage(visibleLatestTask)}
                </p>
              </div>
              <div className='shrink-0 text-sm text-gray-600'>
                <p>Application #{visibleLatestTask.applicationId ?? '-'}</p>
                <p>Resume #{visibleLatestTask.resumeId ?? '-'}</p>
                <p>Job #{visibleLatestTask.jobId ?? '-'}</p>
                {visibleLatestTask.status === 'success' && (
                  <p>
                    Match: {formatResultLabel(visibleLatestTask.matchLevel)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className='rounded-lg border border-gray-200 bg-white shadow-sm'>
        <div className='border-b border-gray-200 px-4 py-4 md:px-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-base font-semibold text-gray-900 md:text-lg'>
                Screening Tasks
              </h2>
              <p className='mt-1 text-xs text-gray-500 md:text-sm'>
                Total {displayedTotal} tasks
              </p>
            </div>
          </div>
        </div>

        <QueryState
          loading={screeningTasksQuery.isLoading}
          error={screeningTasksQuery.error}
          fallback='Failed to load screening tasks.'
        />

        {!screeningTasksQuery.isLoading &&
          !screeningTasksQuery.isError &&
          displayedScreeningTasks.length === 0 && (
            <div className='p-8 text-center text-sm text-gray-500'>
              No screening tasks found.
            </div>
          )}

        <div className='hidden overflow-x-auto md:block'>
          {!screeningTasksQuery.isLoading &&
            !screeningTasksQuery.isError &&
            displayedScreeningTasks.length > 0 && (
              <table className='w-full'>
                <thead className='border-b border-gray-200 bg-gray-50'>
                  <tr>
                    {[
                      'Candidate',
                      'Position',
                      'AI Score',
                      'Match',
                      'Recommendation',
                      'Status',
                      'Error',
                      'Date',
                      ''
                    ].map((head) => (
                      <th
                        key={head}
                        className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200 bg-white'>
                  {displayedScreeningTasks.map((screening) => {
                    const score = getTaskScore(screening)

                    return (
                      <tr
                        key={getTaskKey(screening)}
                        className='transition-colors hover:bg-gray-50'
                      >
                        <td className='whitespace-nowrap px-6 py-4'>
                          <div className='flex items-center'>
                            <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600'>
                              <span className='text-xs font-medium text-white'>
                                {getInitials(getCandidateName(screening))}
                              </span>
                            </div>
                            <span className='ml-3 text-sm font-medium text-gray-900'>
                              {getCandidateName(screening)}
                            </span>
                          </div>
                        </td>
                        <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-600'>
                          {getPosition(screening)}
                        </td>
                        <td className='whitespace-nowrap px-6 py-4'>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(score)}`}
                          >
                            {formatScore(score)}
                          </span>
                        </td>
                        <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-600'>
                          {formatResultLabel(screening.matchLevel)}
                        </td>
                        <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-600'>
                          {formatResultLabel(screening.recommendation)}
                        </td>
                        <td className='whitespace-nowrap px-6 py-4'>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}
                          >
                            {getStatusLabel(screening.status)}
                          </span>
                        </td>
                        <td className='max-w-64 px-6 py-4 text-sm text-red-600'>
                          <span
                            className='block truncate'
                            title={screening.errorMessage ?? undefined}
                          >
                            {screening.errorMessage || '-'}
                          </span>
                        </td>
                        <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                          <div className='flex items-center gap-1'>
                            <Calendar className='h-4 w-4' />
                            {formatTaskDate(
                              screening.date ?? screening.createdAt
                            )}
                          </div>
                        </td>
                        <td className='whitespace-nowrap px-6 py-4 text-right'>
                          {screening.status === 'success' && (
                            <Link
                              to={`/screening/${getTaskId(screening)}`}
                              className='inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
                            >
                              <Eye className='h-3.5 w-3.5' />
                              Detail
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </div>

        {!screeningTasksQuery.isLoading &&
          !screeningTasksQuery.isError &&
          displayedScreeningTasks.length > 0 && (
            <div className='divide-y divide-gray-200 md:hidden'>
              {displayedScreeningTasks.map((screening) => {
                const score = getTaskScore(screening)

                return (
                  <div
                    key={getTaskKey(screening)}
                    className='p-4'
                  >
                    <div className='mb-3 flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium text-gray-900'>
                          {getCandidateName(screening)}
                        </p>
                        <p className='mt-1 truncate text-sm text-gray-600'>
                          {getPosition(screening)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(screening.status)}`}
                      >
                        {getStatusLabel(screening.status)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm text-gray-500'>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreColor(score)}`}
                      >
                        {formatScore(score)}
                      </span>
                      <span className='inline-flex items-center gap-1'>
                        <Calendar className='h-4 w-4' />
                        {formatTaskDate(screening.date ?? screening.createdAt)}
                      </span>
                    </div>
                    <div className='mt-3 grid gap-1 text-xs text-gray-600'>
                      <span>
                        Match: {formatResultLabel(screening.matchLevel)}
                      </span>
                      <span>
                        Recommendation:{' '}
                        {formatResultLabel(screening.recommendation)}
                      </span>
                      {screening.errorMessage && (
                        <span className='text-red-600'>
                          Error: {screening.errorMessage}
                        </span>
                      )}
                    </div>
                    {screening.status === 'success' && (
                      <Link
                        to={`/screening/${getTaskId(screening)}`}
                        className='mt-3 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
                      >
                        <Eye className='h-3.5 w-3.5' />
                        Detail
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        {!screeningTasksQuery.isLoading && !screeningTasksQuery.isError && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={displayedTotal}
            pageSize={PAGE_SIZE}
            onPageChange={changePage}
          />
        )}
      </div>
    </div>
  )
}

function QueryState({
  loading,
  error,
  fallback
}: {
  loading: boolean
  error: unknown
  fallback: string
}) {
  if (loading) {
    return (
      <div className='p-6 text-sm text-gray-600'>
        <div className='flex items-center gap-2'>
          <LoaderCircle className='h-4 w-4 animate-spin' />
          Loading screening tasks...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-4'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
          {getErrorMessage(error, fallback)}
        </div>
      </div>
    )
  }

  return null
}

function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  return (
    <div className='flex flex-col gap-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between md:px-6'>
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
          aria-label='Previous page'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>
        <span className='min-w-24 text-center text-gray-700'>
          Page {currentPage} / {totalPages}
        </span>
        <button
          type='button'
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
          aria-label='Next page'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}
