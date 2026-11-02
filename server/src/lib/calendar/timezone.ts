/**
 * Native Timezone Utilities using IANA Database via Intl.DateTimeFormat
 * Supports robust DST transitions without manual UTC offset math.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// IANA timezone format checks
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  const cleaned = tz.split(' ')[0].trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleaned });
    return true;
  } catch (e) {
    return false;
  }
}

export function sanitizeTimezone(tz?: string | null): string {
  if (!tz || typeof tz !== 'string') return DEFAULT_TIMEZONE;
  const cleaned = tz.split(' ')[0].trim();
  return isValidTimezone(cleaned) ? cleaned : DEFAULT_TIMEZONE;
}

/**
 * Formats a Date object in a specific IANA timezone safely across DST boundaries.
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const safeTz = sanitizeTimezone(timezone);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  };
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

/**
 * Checks if a given UTC date falls within a local time window for a specific IANA timezone.
 * Handles DST transitions seamlessly.
 */
export function isWithinCallingHours(
  utcDate: Date,
  timezone: string,
  startHour: number = 9,
  endHour: number = 21
): boolean {
  const safeTz = sanitizeTimezone(timezone);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    hour: 'numeric',
    hour12: false,
  });

  const hourStr = formatter.format(utcDate);
  let localHour = parseInt(hourStr, 10);
  
  if (localHour === 24) {
    localHour = 0;
  }

  return localHour >= startHour && localHour < endHour;
}

/**
 * Converts local calendar year, month (1-12), day, hour, minute in an IANA timezone into the exact UTC Date.
 * Seamlessly resolves DST shifts without manual math.
 */
export function localTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0,
  second: number = 0,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const safeTz = sanitizeTimezone(timezone);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));

  for (let iter = 0; iter < 4; iter++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(guess);

    const m = Number(parts.find(p => p.type === 'month')?.value);
    const d = Number(parts.find(p => p.type === 'day')?.value);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    let h = Number(parts.find(p => p.type === 'hour')?.value);
    if (h === 24) h = 0;
    const min = Number(parts.find(p => p.type === 'minute')?.value);
    const sec = Number(parts.find(p => p.type === 'second')?.value);

    const diffSeconds =
      ((y - year) * 31536000) +
      ((m - month) * 2592000) +
      ((d - day) * 86400) +
      ((h - hour) * 3600) +
      ((min - minute) * 60) +
      (sec - second);

    if (diffSeconds === 0) break;
    guess = new Date(guess.getTime() - diffSeconds * 1000);
  }

  return guess;
}

/**
 * Returns UTC Date boundaries for a local day (e.g. '2026-11-02') in the workspace timezone.
 * Start: 00:00:00.000 in workspace timezone -> UTC Date
 * End: 23:59:59.999 in workspace timezone -> UTC Date
 */
export function getWorkspaceDayBounds(
  dateStr: string,
  timezone: string = DEFAULT_TIMEZONE
): { startUtc: Date; endUtc: Date } {
  const safeTz = sanitizeTimezone(timezone);
  const [yStr, mStr, dStr] = dateStr.slice(0, 10).split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  const startUtc = localTimeToUtc(y, m, d, 0, 0, 0, safeTz);
  // End of day is start of next day minus 1 millisecond
  const nextDayUtc = localTimeToUtc(y, m, d + 1, 0, 0, 0, safeTz);
  const endUtc = new Date(nextDayUtc.getTime() - 1);

  return { startUtc, endUtc };
}

/**
 * Converts a UTC Date into localized time details for any target IANA timezone.
 */
export function getLocalizedTime(utcDate: Date, targetTimezone: string) {
  const safeTz = sanitizeTimezone(targetTimezone);

  const formattedStr = formatDateInTimezone(utcDate, safeTz, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  return {
    utcIso: utcDate.toISOString(),
    targetTimezone: safeTz,
    displayString: formattedStr,
  };
}

/**
 * Generates native booking slots for a given timezone and date range.
 * Slots are constructed from local business hours in the specified timezone.
 */
export function generateNativeSlots(
  baseDate: Date,
  daysCount: number = 7,
  timezone: string = DEFAULT_TIMEZONE,
  startHour: number = 9,
  endHour: number = 17,
  slotMinutes: number = 30
): Array<{ slotUtc: string; displayLocal: string; timezone: string }> {
  const safeTz = sanitizeTimezone(timezone);
  const slots: Array<{ slotUtc: string; displayLocal: string; timezone: string }> = [];

  // Extract base year, month, day in the target timezone
  const baseParts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(baseDate);

  const baseY = Number(baseParts.find(p => p.type === 'year')?.value);
  const baseM = Number(baseParts.find(p => p.type === 'month')?.value);
  const baseD = Number(baseParts.find(p => p.type === 'day')?.value);

  for (let d = 0; d < daysCount; d++) {
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += slotMinutes) {
        const slotUtc = localTimeToUtc(baseY, baseM, baseD + d, hour, min, 0, safeTz);
        const loc = getLocalizedTime(slotUtc, safeTz);
        slots.push({
          slotUtc: slotUtc.toISOString(),
          displayLocal: loc.displayString,
          timezone: safeTz,
        });
      }
    }
  }

  return slots;
}
