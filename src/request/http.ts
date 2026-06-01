import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { normalizeRequestError, RequestError } from "./errors";
import { queryClient } from "./query-client";
import type { ApiEnvelope, ApiSuccessCode } from "./types";

const ACCESS_TOKEN_KEY = "access_token";
const ACCESS_TOKEN_CHANGED_EVENT = "auth:access-token-changed";
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_SUCCESS_CODES: ApiSuccessCode[] = [0, 200, 201];

function parseSuccessCodes(rawCodes: string | undefined): ApiSuccessCode[] {
  if (!rawCodes?.trim()) {
    return DEFAULT_SUCCESS_CODES;
  }

  const parsedCodes = rawCodes
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const parsed = Number(token);
      return Number.isNaN(parsed) ? token : parsed;
    });

  const dedupedByCode = new Map<string, ApiSuccessCode>();
  [...DEFAULT_SUCCESS_CODES, ...parsedCodes].forEach((code) => {
    dedupedByCode.set(String(code), code);
  });


  return Array.from(dedupedByCode.values());
}

function getApiTimeout(): number {
  const rawTimeout = Number(import.meta.env.VITE_API_TIMEOUT);
  if (Number.isNaN(rawTimeout) || rawTimeout <= 0) {
    return DEFAULT_TIMEOUT;
  }
  return rawTimeout;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && "code" in value && "data" in value;
}

function getEnvelopeMessage(payload: ApiEnvelope<unknown>): string {
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return "Business validation failed";
}

function isSuccessCode(code: ApiSuccessCode, successCodes: ApiSuccessCode[]): boolean {
  return successCodes.some((targetCode) => String(targetCode) === String(code));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function notifyAccessTokenChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(ACCESS_TOKEN_CHANGED_EVENT));
}

export function hasAccessToken(): boolean {
  const token = getAccessToken();
  return typeof token === "string" && token.trim().length > 0;
}

export function subscribeAccessTokenChange(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCESS_TOKEN_KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(ACCESS_TOKEN_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ACCESS_TOKEN_CHANGED_EVENT, callback);
  };
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    clearAccessToken();
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, normalizedToken);
  notifyAccessTokenChanged();
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  notifyAccessTokenChanged();
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const apiSuccessCodes = parseSuccessCodes(import.meta.env.VITE_API_SUCCESS_CODES);

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: getApiTimeout(),
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  const token = getAccessToken();
  if (token) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const responseType = response.config.responseType;
    if (responseType === "blob" || responseType === "arraybuffer") {
      return response;
    }

    if (!isApiEnvelope(response.data)) {
      return response;
    }

    if (isSuccessCode(response.data.code, apiSuccessCodes)) {
      response.data = response.data.data;
      return response;
    }

    throw new RequestError({
      message: getEnvelopeMessage(response.data),
      code: response.data.code,
      status: response.status,
      details: response.data,
    });
  },
  (error: unknown) => {
    const normalizedError = normalizeRequestError(error);
    if (normalizedError.status === 401) {
      clearAccessToken();
      queryClient.clear();
    }
    return Promise.reject(normalizedError);
  },
);

export const request = {
  get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
    return http.get<TResponse>(url, config).then((response) => response.data as TResponse);
  },
  delete<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
    return http.delete<TResponse>(url, config).then((response) => response.data as TResponse);
  },
  post<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig<TBody>): Promise<TResponse> {
    return http.post<TResponse, AxiosResponse<TResponse>, TBody>(url, data, config).then((response) => response.data as TResponse);
  },
  put<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig<TBody>): Promise<TResponse> {
    return http.put<TResponse, AxiosResponse<TResponse>, TBody>(url, data, config).then((response) => response.data as TResponse);
  },
  patch<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig<TBody>): Promise<TResponse> {
    return http.patch<TResponse, AxiosResponse<TResponse>, TBody>(url, data, config).then((response) => response.data as TResponse);
  },
};
