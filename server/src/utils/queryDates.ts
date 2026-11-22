/**
 * Date filters from the query string (audit #161). `new Date('notadate')` is an Invalid Date that
 * Prisma rejects, so a mistyped ?startDate= used to answer 500. Routes now answer 400 instead.
 */
export type QueryDateRange = { ok: true; start?: Date; end?: Date } | { ok: false; error: string };

export function parseDateRange(startRaw: unknown, endRaw: unknown): QueryDateRange {
  const parse = (v: unknown): Date | undefined | null => {
    if (v === undefined || v === null || v === '') return undefined;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const start = parse(startRaw);
  const end = parse(endRaw);
  if (start === null || end === null) {
    return { ok: false, error: 'startDate and endDate must be valid dates, for example 2026-11-22 or 2026-11-22T10:00:00+05:30.' };
  }
  if (start && end && start > end) return { ok: false, error: 'startDate must be before endDate.' };
  return { ok: true, start, end };
}
