import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle,
  // Download,
  LoaderCircle,
  TriangleAlert,
  XCircle
} from 'lucide-react'
import { listOperationLogs, listUsers, type OperationLog } from '../../api'
import { isRequestError } from '../../request'

type LogResult = 'success' | 'failed' | 'warning'
const pageSize = 10

function getErrorMessage(error: unknown, fallback: string): string {
  if (isRequestError(error)) {
    return error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return '-'
  }

  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`
  }

  return value
}

function formatDateParam(value: string): string | undefined {
  const match = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  if (!match) {
    return undefined
  }

  return `${match[1]}-${match[2]}-${match[3]}`
}

function getInitials(value: string | undefined): string {
  const normalized = value?.trim()
  if (!normalized) {
    return '?'
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return normalized.slice(0, 2).toUpperCase()
}

function getLogResult(log: OperationLog): LogResult {
  const source = `${log.action ?? ''} ${log.details ?? ''}`.toLowerCase()
  if (
    /(fail|failed|failure|error|invalid|denied|exceed|oversized|timeout)/.test(
      source
    )
  ) {
    return 'failed'
  }
  if (/(warn|warning|partial|review|required|risk)/.test(source)) {
    return 'warning'
  }
  return 'success'
}

// function resultLabel(result: LogResult): string {
//   if (result === "failed") {
//     return "Failed";
//   }
//   if (result === "warning") {
//     return "Warning";
//   }
//   return "Success";
// }

// function escapeCsvValue(value: string): string {
//   return `"${value.replaceAll('"', '""')}"`;
// }

// function downloadLogsCsv(logs: OperationLog[]): void {
//   const rows = [
//     ["Timestamp", "User", "Action", "Details", "Result"],
//     ...logs.map((log) => [formatTimestamp(log.timestamp), log.user || "-", log.action || "-", log.details || "-", resultLabel(getLogResult(log))]),
//   ];
//   const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
//   const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//   const url = URL.createObjectURL(blob);
//   const link = document.createElement("a");
//   link.href = url;
//   link.download = "operation-logs.csv";
//   document.body.appendChild(link);
//   link.click();
//   document.body.removeChild(link);
//   URL.revokeObjectURL(url);
// }

export default function LogsPage() {
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<LogResult | ''>('')
  const [dateInput, setDateInput] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const usersQuery = useQuery({
    queryKey: ['operation-log-users'],
    queryFn: () => listUsers({ page: 1, pageSize: 100 }),
    staleTime: 5 * 60 * 1000
  })

  const logsQuery = useQuery({
    queryKey: [
      'operation-logs',
      { page, pageSize, user: userFilter, date: dateFilter }
    ],
    queryFn: () =>
      listOperationLogs({
        page,
        pageSize,
        user: userFilter || undefined,
        date: dateFilter || undefined
      }),
    placeholderData: (previousData) => previousData
  })

  const logs = logsQuery.data?.items ?? []
  const displayedLogs = logs.filter((log) => {
    const matchesResult = resultFilter
      ? getLogResult(log) === resultFilter
      : true
    return matchesResult
  })
  const total = logsQuery.data?.total ?? 0
  const fallbackTotalPages = Math.ceil(total / pageSize) || 1
  const totalPages = Math.max(
    1,
    logsQuery.data?.totalPages ?? fallbackTotalPages
  )
  const isPaging = logsQuery.isLoading || logsQuery.isFetching
  const isPreviousDisabled = page <= 1 || isPaging
  const isNextDisabled = page >= totalPages || isPaging
  const currentStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const currentEnd = Math.min(page * pageSize, total)
  const visiblePages = Array.from(
    { length: Math.min(totalPages, 3) },
    (_, index) => index + 1
  )

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault()
    setPage(1)
    setUserFilter(selectedUser)
    setDateFilter(formatDateParam(dateInput) ?? '')
  }

  return (
    <div className='p-4 md:p-6'>
      {/* <div className="mb-8 flex  gap-4 flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-semibold leading-8 text-gray-900">Operation Logs</h1>
          <p className="text-base text-gray-600">Track all system activities and user actions</p>
        </div>
        <button
          type="button"
          onClick={() => downloadLogsCsv(displayedLogs)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          Export Logs
        </button>
      </div> */}

      <form
        onSubmit={submitSearch}
        className='mb-6 flex flex-row  items-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
      >
        <div className=' gap-4  flex-row flex'>
          <select
            value={selectedUser}
            onChange={(event) => setSelectedUser(event.target.value)}
            className='h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
          >
            <option value=''>All Users</option>
            {(usersQuery.data?.items ?? []).map((user) => (
              <option key={String(user.id)} value={user.username}>
                {user.realName && user.realName !== user.username
                  ? `${user.realName} (${user.username})`
                  : user.username}
              </option>
            ))}
          </select>
          <select
            value={resultFilter}
            onChange={(event) =>
              setResultFilter(event.target.value as LogResult | '')
            }
            className='h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
          >
            <option value=''>All Results</option>
            <option value='success'>Success</option>
            <option value='failed'>Failed</option>
            <option value='warning'>Warning</option>
          </select>
          <input
            type='date'
            value={dateInput}
            onChange={(event) => setDateInput(event.target.value)}
            className='h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
          />
          <div className='flex gap-3'>
            <button
              type='submit'
              className='inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700'
            >
              Search
            </button>
          </div>
        </div>
      </form>

      <div className='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
        {logsQuery.isLoading && (
          <div className='flex min-h-72 items-center justify-center text-sm text-gray-500'>
            <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
            Loading logs...
          </div>
        )}

        {logsQuery.isError && (
          <div className='m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {getErrorMessage(logsQuery.error, 'Failed to load operation logs.')}
          </div>
        )}

        {!logsQuery.isLoading && !logsQuery.isError && (
          <>
            <div className='hidden overflow-x-auto md:block'>
              <table className='w-full table-fixed'>
                <thead className='border-b border-gray-200 bg-gray-50'>
                  <tr>
                    <th className='w-[280px] px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'>
                      Timestamp
                    </th>
                    <th className='w-[260px] px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'>
                      User
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'>
                      Action
                    </th>
                    <th className='w-[420px] px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'>
                      Details
                    </th>
                    <th className='w-[220px] px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500'>
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200 bg-white'>
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className='px-6 py-20'
                      >
                        <EmptyState />
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log) => (
                      <LogRow
                        key={String(log.id)}
                        log={log}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className='flex flex-col gap-3 border-t border-gray-200 bg-white px-6 py-4 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between'>
              <span>
                Showing {currentStart} to {currentEnd} of {total} results
              </span>
              <div className='flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={isPreviousDisabled}
                  className='inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-70'
                >
                  Previous
                </button>
                {visiblePages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type='button'
                    onClick={() => setPage(pageNumber)}
                    disabled={isPaging}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium ${
                      pageNumber === page
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-70`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type='button'
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={isNextDisabled}
                  className='inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-70'
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LogRow({ log }: { log: OperationLog }) {
  return (
    <tr className='transition-colors hover:bg-gray-50'>
      <td className='whitespace-nowrap px-6 py-4 text-sm text-slate-500'>
        <div className='flex items-center gap-2'>
          <Calendar className='h-4 w-4 text-slate-500' />
          {formatTimestamp(log.timestamp)}
        </div>
      </td>
      <td className='px-6 py-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white'>
            {getInitials(log.user)}
          </div>
          <span className='truncate text-sm font-semibold text-gray-900'>
            {log.user || '-'}
          </span>
        </div>
      </td>
      <td className='px-6 py-4 text-sm text-gray-900'>{log.action || '-'}</td>
      <td className='px-6 py-4 text-sm text-slate-600'>{log.details || '-'}</td>
      <td className='px-6 py-4'>
        <ResultBadge result={getLogResult(log)} />
      </td>
    </tr>
  )
}

function ResultBadge({ result }: { result: LogResult }) {
  if (result === 'failed') {
    return (
      <div className='flex items-center gap-2'>
        <XCircle className='h-5 w-5 text-red-500' />
        <span className='rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700'>
          Failed
        </span>
      </div>
    )
  }

  if (result === 'warning') {
    return (
      <div className='flex items-center gap-2'>
        <TriangleAlert className='h-5 w-5 text-amber-500' />
        <span className='rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700'>
          Warning
        </span>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <CheckCircle className='h-5 w-5 text-green-600' />
      <span className='rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'>
        Success
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className='text-center'>
      <p className='text-sm font-semibold text-gray-900'>
        No operation logs found
      </p>
      <p className='mt-2 text-sm text-gray-500'>
        New activity will appear here once it is recorded.
      </p>
    </div>
  )
}
