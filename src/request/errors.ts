import axios, { type AxiosError } from "axios";
import type { ApiSuccessCode } from "./types";

interface RequestErrorParams {
  message: string;
  code?: ApiSuccessCode;
  status?: number;
  details?: unknown;
  isNetworkError?: boolean;
}

export class RequestError extends Error {
  readonly code?: ApiSuccessCode;
  readonly status?: number;
  readonly details?: unknown;
  readonly isNetworkError: boolean;

  constructor(params: RequestErrorParams) {
    super(params.message);
    this.name = "RequestError";
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.isNetworkError = Boolean(params.isNetworkError);
  }
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError;
}

function readMessageFromPayload(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const maybeMessage = (payload as { message?: unknown }).message;
  if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
    return maybeMessage;
  }

  const maybeError = (payload as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim().length > 0) {
    return maybeError;
  }

  const maybeMsg = (payload as { msg?: unknown }).msg;
  if (typeof maybeMsg === "string" && maybeMsg.trim().length > 0) {
    return maybeMsg;
  }

  return undefined;
}

function readCodeFromPayload(payload: unknown): ApiSuccessCode | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const code = (payload as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") {
    return code;
  }

  return undefined;
}

export function normalizeRequestError(error: unknown): RequestError {
  if (isRequestError(error)) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return new RequestError({
      message: error instanceof Error ? error.message : "Unknown request error",
      details: error,
    });
  }

  const axiosError = error as AxiosError<unknown>;
  if (axiosError.code === "ECONNABORTED") {
    return new RequestError({
      message: "Request timed out. Please try again.",
      code: "REQUEST_TIMEOUT",
      details: axiosError,
      isNetworkError: true,
    });
  }

  const status = axiosError.response?.status;
  const payload = axiosError.response?.data;
  const payloadMessage = readMessageFromPayload(payload);
  const payloadCode = readCodeFromPayload(payload);

  if (!axiosError.response) {
    return new RequestError({
      message: axiosError.message || "Network error. Please check your connection.",
      code: "NETWORK_ERROR",
      details: axiosError,
      isNetworkError: true,
    });
  }

  return new RequestError({
    message: payloadMessage || axiosError.message || "Request failed",
    code: payloadCode,
    status,
    details: payload ?? axiosError,
    isNetworkError: false,
  });
}
