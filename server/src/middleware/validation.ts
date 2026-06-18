// ─────────────────────────────────────────────
// Voice Runtime Engine — Validation Middleware
// ─────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '../types/errors';

/**
 * Extracts field-level error details from a {@link ZodError} and wraps them in
 * a {@link ValidationError} that the global error handler can serialise.
 */
function buildValidationError(zodError: ZodError): ValidationError {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  return new ValidationError('Request validation failed', details);
}

/**
 * Creates Express middleware that validates `req.body` against the given Zod schema.
 *
 * On success the parsed (and potentially transformed) value replaces `req.body`
 * so downstream handlers always receive clean, typed data.
 *
 * @param schema - A Zod schema describing the expected request body shape.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { validateBody } from '../middleware/validation';
 *
 * const createAgentSchema = z.object({ name: z.string().min(1) });
 * router.post('/agents', validateBody(createAgentSchema), createAgentHandler);
 * ```
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw buildValidationError(result.error);
    }

    Object.defineProperty(req, 'body', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

/**
 * Creates Express middleware that validates `req.params` against the given Zod schema.
 *
 * @param schema - A Zod schema describing the expected route parameters.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { validateParams } from '../middleware/validation';
 *
 * const idParamSchema = z.object({ id: z.string().uuid() });
 * router.get('/agents/:id', validateParams(idParamSchema), getAgentHandler);
 * ```
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      throw buildValidationError(result.error);
    }

    Object.defineProperty(req, 'params', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

/**
 * Creates Express middleware that validates `req.query` against the given Zod schema.
 *
 * @param schema - A Zod schema describing the expected query-string parameters.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { validateQuery } from '../middleware/validation';
 *
 * const paginationSchema = z.object({
 *   page: z.coerce.number().int().positive().default(1),
 *   limit: z.coerce.number().int().positive().max(100).default(20),
 * });
 * router.get('/calls', validateQuery(paginationSchema), listCallsHandler);
 * ```
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      throw buildValidationError(result.error);
    }

    Object.defineProperty(req, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
