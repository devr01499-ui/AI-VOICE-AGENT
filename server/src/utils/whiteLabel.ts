// ─────────────────────────────────────────────
// White-label guard (audit #95)
// ─────────────────────────────────────────────
// Customers must never see the names of the telephony carriers we resell. Internal code, logs and
// the staff console keep the real names; anything a customer can read (API error text, in-app
// notifications, emails) goes through these helpers.

import type { Request, Response, NextFunction } from 'express';

const CARRIER_WORDS: Array<[RegExp, string]> = [
  [/\b(vobiz|plivo)\s+(sub-?accounts?)\b/gi, 'calling $2'],
  [/\b(vobiz|plivo)\s+(accounts?)\b/gi, 'calling $2'],
  [/\b(vobiz|plivo)\s+console\b/gi, 'carrier console'],
  [/vobiz|plivo/gi, 'carrier'],
];

/** Replaces carrier names in customer-facing text with neutral wording. */
export function scrubCarrierNames(text: string): string {
  if (typeof text !== 'string' || !/vobiz|plivo/i.test(text)) return text;
  let out = text;
  for (const [re, replacement] of CARRIER_WORDS) out = out.replace(re, replacement);
  return out;
}

/** Scrubs the customer-readable text fields of a JSON response body (error / message / reason). */
export function scrubResponseBody(body: any): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  let changed = false;
  const out: any = { ...body };
  for (const key of ['error', 'message', 'reason', 'hint']) {
    const v = out[key];
    if (typeof v === 'string') {
      const s = scrubCarrierNames(v);
      if (s !== v) { out[key] = s; changed = true; }
    } else if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.message === 'string') {
      const s = scrubCarrierNames(v.message);
      if (s !== v.message) { out[key] = { ...v, message: s }; changed = true; }
    }
  }
  return changed ? out : body;
}

/**
 * Express middleware: every JSON answer on the customer API has carrier names removed from its
 * error/message text. Staff routes (/api/v2/admin) and carrier webhooks keep the real names.
 */
export function whiteLabelResponses(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl || req.url || '';
  if (path.startsWith('/api/v2/admin') || path.startsWith('/api/v2/webhooks')) return next();
  const original = res.json.bind(res);
  (res as any).json = (body: any) => original(scrubResponseBody(body));
  next();
}
