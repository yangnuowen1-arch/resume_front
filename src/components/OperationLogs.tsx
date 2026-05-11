import { Search, Download, CheckCircle, XCircle, AlertTriangle, Calendar } from "lucide-react";

export function OperationLogs() {
  const logs = [
    { id: 1, user: "HR Manager", action: "Started AI screening for Senior Frontend Developer", result: "Success", details: "Processed 12 resumes", timestamp: "2026-05-09 10:35:22" },
    { id: 2, user: "John Smith", action: "Created new job position: Product Manager", result: "Success", details: "Job ID: #1247", timestamp: "2026-05-09 09:42:18" },
    { id: 3, user: "HR Manager", action: "Uploaded 5 resumes for UX Designer", result: "Success", details: "Files: 5 PDF documents", timestamp: "2026-05-09 08:55:03" },
    { id: 4, user: "HR Manager", action: "Attempted to upload oversized resume file", result: "Failed", details: "File size exceeded 10MB", timestamp: "2026-05-08 16:48:12" },
  ];

  const getResultIcon = (result: string) => result === "Success" ? <CheckCircle className="h-5 w-5 text-green-600" /> : result === "Failed" ? <XCircle className="h-5 w-5 text-red-600" /> : <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  const getResultColor = (result: string) => result === "Success" ? "text-green-700 bg-green-100" : result === "Failed" ? "text-red-700 bg-red-100" : "text-yellow-700 bg-yellow-100";

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">Operation Logs</h1>
          <p className="text-sm text-gray-600 md:text-base">Track all system activities and user actions</p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 md:text-base">
          <Download className="h-5 w-5" />Export Logs
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search logs..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>{["Timestamp", "User", "Action", "Details", "Result"].map((head) => <th key={head} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"><div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{log.timestamp}</div></td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{log.user}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{log.action}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                  <td className="whitespace-nowrap px-6 py-4"><div className="flex items-center gap-2">{getResultIcon(log.result)}<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getResultColor(log.result)}`}>{log.result}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
