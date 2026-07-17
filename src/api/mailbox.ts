import { request } from "../request";
export interface GoogleMailboxOAuthUrlResponse {
  url: string;
}

export type MailboxScanStatus = "pending" | "running" | "done" | "failed" | string;

export interface MailboxScanTask {
  status: MailboxScanStatus;
  scanned?: number;
  imported?: number;
  skipped?: number;
  error?: string | null;
}

/**
 * The API contract uses lower-camel-case fields.  Keep this legacy shape at
 * the boundary while the mailbox service still serializes Go field names.
 */
interface MailboxScanTaskResponse {
  status?: MailboxScanStatus | null;
  Status?: MailboxScanStatus | null;
  scanned?: number | null;
  Scanned?: number | null;
  imported?: number | null;
  Imported?: number | null;
  skipped?: number | null;
  Skipped?: number | null;
  error?: string | null;
  Error?: string | null;
}

function normalizeMailboxScanTask(task: MailboxScanTaskResponse): MailboxScanTask {
  return {
    status: task.status ?? task.Status ?? "",
    scanned: task.scanned ?? task.Scanned ?? undefined,
    imported: task.imported ?? task.Imported ?? undefined,
    skipped: task.skipped ?? task.Skipped ?? undefined,
    error: task.error ?? task.Error ?? undefined,
  };
}

/**
 * Starts the Google OAuth flow. Credentials are required here because the
 * backend stores its one-time OAuth state in an HttpOnly cookie.
 */
export function getGoogleMailboxOAuthUrl(): Promise<GoogleMailboxOAuthUrlResponse> {
  return request.get<GoogleMailboxOAuthUrlResponse>("/mailbox/oauth/google/url", {
    withCredentials: true,
  });
}

export function getMailboxScan(taskId: string): Promise<MailboxScanTask> {
  return request
    .get<MailboxScanTaskResponse>("/mailbox/scan/" + encodeURIComponent(taskId))
    .then(normalizeMailboxScanTask);
}
