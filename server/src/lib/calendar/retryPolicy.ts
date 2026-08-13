/**
 * Logic to calculate backoff times for call retries.
 */

const RETRY_INTERVALS_MS = [
  15 * 60 * 1000, // 15 mins
  60 * 60 * 1000, // 1 hr
  24 * 60 * 60 * 1000, // 24 hrs
];

export function getNextRetryTime(attemptCount: number, currentTime: Date = new Date()): Date | null {
  // If we've exhausted our intervals (i.e. attemptCount is higher than available intervals)
  // then we don't retry. (This expects attemptCount to start at 1 after the first attempt)
  if (attemptCount < 1 || attemptCount > RETRY_INTERVALS_MS.length) {
    return null;
  }

  const interval = RETRY_INTERVALS_MS[attemptCount - 1];
  return new Date(currentTime.getTime() + interval);
}
