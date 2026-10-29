/**
 * Standard interfaces and utilities for Server-Side Search, Filter, and Pagination
 * across all tables in JeevanSetu.
 */

export interface PaginatedQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: any;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T, TStats = Record<string, any>> {
  data: T[];
  meta: PaginationMeta;
  stats?: TStats;
}

/**
 * Standard indices helper for "Showing X to Y of Z entries"
 */
export function calculatePaginationIndices(page: number, limit: number, total: number): { startIndex: number; endIndex: number } {
  if (!total || total <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, total);
  return { startIndex, endIndex };
}

/**
 * Default pagination metadata fallback
 */
export function createDefaultPaginationMeta(limit = 10): PaginationMeta {
  return {
    total: 0,
    page: 1,
    limit,
    totalPages: 1,
  };
}
