import { request } from "../request";

export type JobCategoryStatus = "active" | "disabled";

export interface JobCategory {
  id: number | string;
  name: string;
  description?: string;
  status: JobCategoryStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListJobCategoriesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: JobCategoryStatus;
}

export interface ListJobCategoriesResponse {
  items: JobCategory[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateJobCategoryRequest {
  name: string;
  description?: string;
  status?: JobCategoryStatus;
}

function normalizeId(value: unknown, fallback: string): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return fallback;
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function normalizeJobCategory(item: unknown, index: number): JobCategory {
  const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
  const id = normalizeId(raw.id ?? raw.categoryId ?? raw.ID ?? raw.Id, `unknown-${index}`);
  const name =
    typeof raw.name === "string"
      ? raw.name
      : typeof raw.categoryName === "string"
        ? raw.categoryName
        : typeof raw.title === "string"
          ? raw.title
          : `Category ${index + 1}`;
  const description = typeof raw.description === "string" ? raw.description : undefined;
  const status = typeof raw.status === "string" ? raw.status : "active";
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : undefined;
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : undefined;

  return {
    id,
    name,
    description,
    status,
    createdAt,
    updatedAt,
  };
}

function pickItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const raw = payload as Record<string, unknown>;
  return readArray(raw.items ?? raw.list ?? raw.records ?? raw.rows ?? raw.result ?? raw.data);
}

function pickTotal(payload: unknown, fallback: number): number {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;
  const total = raw.total ?? raw.totalCount ?? raw.count;
  if (typeof total === "number" && Number.isFinite(total)) {
    return total;
  }

  const pagination = typeof raw.pagination === "object" && raw.pagination !== null ? (raw.pagination as Record<string, unknown>) : undefined;
  const nestedTotal = pagination?.total;
  if (typeof nestedTotal === "number" && Number.isFinite(nestedTotal)) {
    return nestedTotal;
  }

  return fallback;
}

function pickPage(payload: unknown, fallback: number): number {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;
  const page = raw.page ?? raw.pageNum ?? raw.currentPage;
  if (typeof page === "number" && Number.isFinite(page) && page > 0) {
    return page;
  }

  const pagination = typeof raw.pagination === "object" && raw.pagination !== null ? (raw.pagination as Record<string, unknown>) : undefined;
  const nestedPage = pagination?.page;
  if (typeof nestedPage === "number" && Number.isFinite(nestedPage) && nestedPage > 0) {
    return nestedPage;
  }

  return fallback;
}

function pickPageSize(payload: unknown, fallback: number): number {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;
  const pageSize = raw.pageSize ?? raw.size ?? raw.page_limit;
  if (typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0) {
    return pageSize;
  }

  const pagination = typeof raw.pagination === "object" && raw.pagination !== null ? (raw.pagination as Record<string, unknown>) : undefined;
  const nestedPageSize = pagination?.pageSize;
  if (typeof nestedPageSize === "number" && Number.isFinite(nestedPageSize) && nestedPageSize > 0) {
    return nestedPageSize;
  }

  return fallback;
}

function normalizeListResponse(payload: unknown, fallbackPage: number, fallbackPageSize: number): ListJobCategoriesResponse {
  const rawItems = pickItems(payload);
  const items = rawItems.map(normalizeJobCategory);

  return {
    items,
    total: pickTotal(payload, items.length),
    page: pickPage(payload, fallbackPage),
    pageSize: pickPageSize(payload, fallbackPageSize),
  };
}

export async function listJobCategories(params: ListJobCategoriesParams = {}): Promise<ListJobCategoriesResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const payload = await request.get<unknown>("/job-categories", {
    params: {
      page,
      pageSize,
      keyword: params.keyword,
      status: params.status,
    },
  });

  return normalizeListResponse(payload, page, pageSize);
}

export function createJobCategory(payload: CreateJobCategoryRequest): Promise<unknown> {
  return request.post<unknown, CreateJobCategoryRequest>("/job-categories", payload);
}
