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
 * Starts the Google OAuth flow. Credentials are required here because the
 * backend stores its one-time OAuth state in an HttpOnly cookie.
 */
export function getGoogleMailboxOAuthUrl(): Promise<GoogleMailboxOAuthUrlResponse> {
  return request.get<GoogleMailboxOAuthUrlResponse>("/mailbox/oauth/google/url", {
    withCredentials: true,
  });
}

export function getMailboxScan(taskId: string): Promise<MailboxScanTask> {
  return request.get<MailboxScanTask>("/mailbox/scan/" + encodeURIComponent(taskId));
}
