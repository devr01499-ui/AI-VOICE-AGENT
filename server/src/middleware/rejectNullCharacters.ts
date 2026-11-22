import type { Request, Response, NextFunction } from 'express';

/**
 * Audit #162: Postgres cannot store or compare text that contains a NUL character (\u0000), so a
 * query parameter or JSON field holding one (for example ?search=a%00b) made the request fail with
 * a database error and a 500. No legitimate input contains it: refuse it up front with a 400.
 */
function containsNul(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (typeof value === 'string') return value.includes('\u0000');
  if (Array.isArray(value)) return value.some((v) => containsNul(v, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([k, v]) => k.includes('\u0000') || containsNul(v, depth + 1));
  }
  return false;
}

export function rejectNullCharacters(req: Request, res: Response, next: NextFunction): void {
  if (containsNul(req.query) || containsNul(req.params) || containsNul(req.body)) {
    res.status(400).json({ success: false, error: 'The request contains an invalid character (NUL). Please remove it and try again.', code: 'INVALID_CHARACTER' });
    return;
  }
  next();
}
