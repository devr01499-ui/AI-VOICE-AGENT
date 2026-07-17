// ─────────────────────────────────────────────
// Voice Runtime Engine — Global Error Handler
// ─────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../types/errors';
import { logger } from './logger';
import { env } from '../config/env';

/**
 * Standardised error-response envelope returned to every client.
 */
interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/**
 * Express error-handling middleware (4-arity signature).
 *
 * Must be registered **after** all route handlers so Express forwards
 * unhandled errors here.
 *
 * Behaviour:
 * 1. {@link ValidationError} → 400 with field-level `details`.
 * 2. Any other {@link AppError} → its declared `statusCode` + `code`.
 * 3. Unknown / non-operational errors → 500 with a generic message and full
 *    stack trace logged at `error` level.
 *
 * Every response includes the `requestId` from the upstream
 * {@link requestIdMiddleware} for end-to-end tracing.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId =
    (typeof req.headers['x-request-id'] === 'string'
      ? req.headers['x-request-id']
      : '') || 'unknown';

  // ── Validation errors (400) ──────────────────
  if (err instanceof ValidationError || (err && typeof err === 'object' && 'details' in err && (err as any).code === 'VALIDATION_ERROR')) {
    const vErr = err as any;
    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: vErr.code || 'VALIDATION_ERROR',
        message: vErr.message,
        requestId,
        details: vErr.details,
      },
    };

    logger.warn('Validation error', {
      requestId,
      code: vErr.code || 'VALIDATION_ERROR',
      details: vErr.details,
    });

    res.status(vErr.statusCode || 400).json(body);
    return;
  }

  // ── Known operational errors ─────────────────
  if (err instanceof AppError || (err && typeof err === 'object' && 'statusCode' in err && 'code' in err)) {
    const appErr = err as any;
    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: appErr.code,
        message: appErr.message,
        requestId,
      },
    };

    if (appErr.isOperational !== false) {
      logger.warn('Operational error', {
        requestId,
        code: appErr.code,
        statusCode: appErr.statusCode,
      });
    } else {
      logger.error('Non-operational AppError', {
        requestId,
        code: appErr.code,
        statusCode: appErr.statusCode,
        stack: appErr.stack,
      });
    }

    res.status(appErr.statusCode).json(body);
    return;
  }

  // ── Unexpected / unknown errors (500) ────────
  const refCode = `ERR-500-${Date.now()}`;
  logger.error(`Unhandled error [${refCode}]`, {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    refCode,
  });

  const displayMessage = env.NODE_ENV === 'development'
    ? `An unexpected error occurred: ${err.message}`
    : `An unexpected error occurred (Reference: ${refCode})`;

  const body: ErrorResponseBody = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: displayMessage,
      requestId,
    },
  };

  res.status(500).json(body);
}
