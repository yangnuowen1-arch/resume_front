import { request } from "../request";
import { normalizePaginatedResponse, type ApiId, type ApiPaginatedResponse, type PaginatedResponse } from "./types";

export interface OperationLog {
  id: ApiId;
  timestamp: string;
  userId?: ApiId;
  user: string;
  action: string;
  details: string;
  module?: string;
  targetType?: string;
  targetId?: ApiId;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: string;
  afterData?: string;
  createdAt?: string;
}

export interface ListOperationLogsParams {
  page?: number;
  pageSize?: number;
  user?: string;
}

export type ListOperationLogsResponse = PaginatedResponse<OperationLog>;

export function listOperationLogs(params: ListOperationLogsParams = {}): Promise<ListOperationLogsResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  return request.get<ApiPaginatedResponse<OperationLog>>("/operation-logs", {
    params: {
      page,
      pageSize,
      user: params.user,
    },
  }).then((response) => normalizePaginatedResponse(response, { page, pageSize }));
}
