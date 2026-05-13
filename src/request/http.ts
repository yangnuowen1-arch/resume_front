import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { normalizeRequestError, RequestError } from "./errors";
import type { ApiEnvelope, ApiSuccessCode } from "./types";

const ACCESS_TOKEN_KEY = "access_token";
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_SUCCESS_CODES: ApiSuccessCode[] = [0, 200];

function parseSuccessCodes(rawCodes: string | undefined): ApiSuccessCode[] {
  if (!rawCodes || rawCodes.trim().length === 0) {
    return DEFAULT_SUCCESS_CODES;
  }

  return rawCodes
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((code) => {
      const parsed = Number(code);
      return Number.isNaN(parsed) ? code : parsed;
    });
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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const apiSuccessCodes = parseSuccessCodes(import.meta.env.VITE_API_SUCCESS_CODES);

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: getApiTimeout(),
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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
