// ─────────────────────────────────────────────
// Voice Runtime Engine — Global Error Handler
// ─────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../types/errors';
import { logger } from './logger';

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
  if (err instanceof ValidationError) {
    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details,
      },
    };

    logger.warn('Validation error', {
      requestId,
      code: err.code,
      details: err.details,
    });

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Known operational errors ─────────────────
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    };

    if (err.isOperational) {
      logger.warn('Operational error', {
        requestId,
        code: err.code,
        statusCode: err.statusCode,
      });
    } else {
      logger.error('Non-operational AppError', {
        requestId,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
      });
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unexpected / unknown errors (500) ────────
  logger.error('Unhandled error', {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  const body: ErrorResponseBody = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  };

  res.status(500).json(body);
}
