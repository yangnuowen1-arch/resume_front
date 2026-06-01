export type ApiId = string | number;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export type ApiPaginatedResponse<TItem> =
  | PaginatedResponse<TItem>
  | {
      items: TItem[];
      pagination: PaginationMeta;
    };

export function normalizePaginatedResponse<TItem>(
  response: ApiPaginatedResponse<TItem>,
  fallback: Pick<PaginationMeta, "page" | "pageSize">,
): PaginatedResponse<TItem> {
  if ("pagination" in response && response.pagination) {
    return {
      items: response.items,
      page: response.pagination.page,
      pageSize: response.pagination.pageSize,
      total: response.pagination.total,
      totalPages: response.pagination.totalPages,
    };
  }

  const flatResponse = response as PaginatedResponse<TItem>;

  return {
    items: flatResponse.items,
    page: flatResponse.page ?? fallback.page,
    pageSize: flatResponse.pageSize ?? fallback.pageSize,
    total: flatResponse.total ?? flatResponse.items.length,
    totalPages: flatResponse.totalPages,
  };
}
