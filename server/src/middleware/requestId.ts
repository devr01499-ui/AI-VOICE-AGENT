// ─────────────────────────────────────────────
// Voice Runtime Engine — Request ID Middleware
// ─────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

// ── Module augmentation ───────────────────────
declare global {
  namespace Express {
    interface Request {
      /** Unique identifier assigned to every incoming HTTP request. */
      requestId: string;
    }
  }
}

/**
 * Attaches a unique request ID to every incoming request.
 *
 * - Reuses the `x-request-id` header when supplied by an upstream proxy or gateway.
 * - Generates a UUID v4 otherwise.
 * - Exposes the ID on `req.requestId` for downstream handlers.
 * - Echoes the ID back via the `X-Request-ID` response header for client correlation.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existing = req.headers['x-request-id'];
  const requestId = typeof existing === 'string' && existing.length > 0
    ? existing
    : uuidv4();

  // Attach to request object for convenient access in handlers / services.
  req.requestId = requestId;

  // Normalise the incoming header so downstream middleware sees a consistent value.
  req.headers['x-request-id'] = requestId;

  // Echo back to the caller for tracing.
  res.setHeader('X-Request-ID', requestId);

  next();
}
