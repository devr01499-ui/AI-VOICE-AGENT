/**
 * Calendar Timezone utilities
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
 * Check if a given UTC date falls within a specific local time window for a given timezone.
 * @param utcDate The date object to check (must be parsed in UTC context)
 * @param timezone The IANA timezone string (e.g. 'Asia/Kolkata')
 * @param startHour The start hour in 24h format (inclusive, e.g. 9 for 09:00)
 * @param endHour The end hour in 24h format (exclusive, e.g. 21 for 21:00)
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

  // Convert the UTC date to the given timezone string representation (e.g. "9/15/2023, 10:00:00 AM")
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });

  const hourStr = formatter.format(utcDate);
  let localHour = parseInt(hourStr, 10);
  
  // Format may return "24" instead of "0" for midnight in some Node versions
  if (localHour === 24) {
      localHour = 0;
  }

  return localHour >= startHour && localHour < endHour;
}
