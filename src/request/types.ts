export type ApiSuccessCode = number | string;

export interface ApiEnvelope<T = unknown> {
  code: ApiSuccessCode;
  data: T;
  error?: string;
  message?: string;
  requestId?: string;
  timestamp?: string;
}
