/**
 * Native Timezone Utilities using IANA Database via Intl.DateTimeFormat
 * Supports robust DST transitions without manual UTC offset math.
 */

// IANA timezone format checks
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Formats a Date object in a specific IANA timezone safely across DST boundaries.
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
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
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
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
 * Converts a UTC Date into localized time details for any target IANA timezone.
 */
export function getLocalizedTime(utcDate: Date, targetTimezone: string) {
  if (!isValidTimezone(targetTimezone)) {
    throw new Error(`Invalid target timezone: ${targetTimezone}`);
  }

  const formattedStr = formatDateInTimezone(utcDate, targetTimezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return {
    utcIso: utcDate.toISOString(),
    targetTimezone,
    displayString: formattedStr,
  };
}

/**
 * Generates native booking slots for a given timezone and date range.
 */
export function generateNativeSlots(
  baseDate: Date,
  daysCount: number = 7,
  timezone: string = 'Asia/Kolkata',
  startHour: number = 9,
  endHour: number = 17,
  slotMinutes: number = 30
): Array<{ slotUtc: string; displayLocal: string; timezone: string }> {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const slots = [];
  const startMs = baseDate.getTime();

  for (let d = 0; d < daysCount; d++) {
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += slotMinutes) {
        // Construct target date
        const target = new Date(startMs + d * 86400000);
        target.setUTCHours(hour, min, 0, 0);

        if (isWithinCallingHours(target, timezone, startHour, endHour)) {
          const loc = getLocalizedTime(target, timezone);
          slots.push({
            slotUtc: target.toISOString(),
            displayLocal: loc.displayString,
            timezone,
          });
        }
      }
    }
  }

  return slots;
}
