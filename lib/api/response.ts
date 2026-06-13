/**
 * Bolna API — Standardized Response Helpers
 *
 * Every API endpoint must use these helpers to ensure consistent response shapes.
 */

import { NextResponse } from 'next/server';
import { ApiError } from './errors';

// ─── Request ID ───────────────────────────────────────
let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter += 1;
  return `req_${Date.now().toString(36)}_${requestCounter.toString(36)}`;
}

// ─── Pagination ───────────────────────────────────────

export interface PaginationMeta {
  total_count: number;
  page_number: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export function buildPaginationMeta(
  totalCount: number,
  pageNumber: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  return {
    total_count: totalCount,
    page_number: pageNumber,
    page_size: pageSize,
    total_pages: totalPages,
    has_next_page: pageNumber < totalPages,
    has_previous_page: pageNumber > 1,
  };
}

// ─── Success Responses ───────────────────────────────

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function createdResponse<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function acceptedResponse<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 202 });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function paginatedResponse<T>(
  dataKey: string,
  data: T[],
  totalCount: number,
  pageNumber: number,
  pageSize: number
): NextResponse {
  return NextResponse.json(
    {
      [dataKey]: data,
      pagination: buildPaginationMeta(totalCount, pageNumber, pageSize),
    },
    { status: 200 }
  );
}

// ─── Error Responses ──────────────────────────────────

export function errorResponse(error: ApiError, requestId?: string): NextResponse {
  const body: Record<string, unknown> = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
      request_id: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };

  const headers: Record<string, string> = {};

  // Add rate-limit specific headers
  if (error.code === 'rate_limit_exceeded' && 'retryAfter' in error) {
    headers['Retry-After'] = String((error as any).retryAfter);
  }

  return NextResponse.json(body, { status: error.statusCode, headers });
}

export function handleUnknownError(err: unknown, requestId?: string): NextResponse {
  if (err instanceof ApiError) {
    return errorResponse(err, requestId);
  }

  console.error('[INTERNAL_ERROR]', err);

  return NextResponse.json(
    {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
        request_id: requestId || generateRequestId(),
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}
