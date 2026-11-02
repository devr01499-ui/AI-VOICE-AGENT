/**
 * Claritiy Voice — Workspace-Aware Timezone & Date Formatting Utility
 *
 * Rules:
 * - Dates are stored in UTC everywhere on the server.
 * - Default timezone for a new workspace is 'Asia/Kolkata'.
 * - Every screen displays dates/times in the workspace's selected timezone.
 * - Dates that matter (call history, reports, batch schedule, calendar, calling hours, notifications, CSV exports)
 *   include the timezone label.
 */

export const DEFAULT_WORKSPACE_TIMEZONE = 'Asia/Kolkata';

/**
 * Clean and validate an IANA timezone string.
 * Strips legacy labels such as 'Asia/Kolkata (UTC+5:30)' -> 'Asia/Kolkata'.
 */
export function normalizeTimezone(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_WORKSPACE_TIMEZONE;
  const cleaned = raw.split(' ')[0].trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleaned });
    return cleaned;
  } catch {
    return DEFAULT_WORKSPACE_TIMEZONE;
  }
}

/**
 * Retrieves the currently active workspace timezone from localStorage.
 * Falls back to 'Asia/Kolkata'.
 */
export function getWorkspaceTimezone(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_WORKSPACE_TIMEZONE;
  }
  try {
    const raw = localStorage.getItem('workspace_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.timezone) {
        return normalizeTimezone(parsed.timezone);
      }
    }
  } catch {}
  return DEFAULT_WORKSPACE_TIMEZONE;
}

/**
 * Format a Date, ISO string, or timestamp into date & time in the workspace timezone.
 * Example: "Nov 2, 2026, 08:30 PM IST"
 */
export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions & { showZone?: boolean; tz?: string }
): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const timeZone = options?.tz ? normalizeTimezone(options.tz) : getWorkspaceTimezone();
  const showZone = options?.showZone !== false;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(showZone ? { timeZoneName: 'short' } : {}),
    ...options,
  };

  delete (defaultOptions as any).showZone;
  delete (defaultOptions as any).tz;

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    return d.toISOString();
  }
}

/**
 * Format date portion only in workspace timezone.
 * Example: "Nov 2, 2026"
 */
export function formatDate(
  dateInput: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions & { tz?: string }
): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const timeZone = options?.tz ? normalizeTimezone(options.tz) : getWorkspaceTimezone();

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  };
  delete (defaultOptions as any).tz;

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Format time portion only in workspace timezone.
 * Example: "08:30 PM IST"
 */
export function formatTime(
  dateInput: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions & { showZone?: boolean; tz?: string }
): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const timeZone = options?.tz ? normalizeTimezone(options.tz) : getWorkspaceTimezone();
  const showZone = options?.showZone ?? false;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(showZone ? { timeZoneName: 'short' } : {}),
    ...options,
  };
  delete (defaultOptions as any).showZone;
  delete (defaultOptions as any).tz;

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    return d.toTimeString().slice(0, 5);
  }
}

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago") with fallback to full localized date.
 */
export function formatRelativeTime(
  dateInput: Date | string | number | null | undefined,
  tz?: string
): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const now = Date.now();
  const diffSec = Math.round((now - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';

  return formatDateTime(d, { showZone: true, tz });
}
