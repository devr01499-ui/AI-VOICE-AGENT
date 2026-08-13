import { isWithinCallingHours } from './timezone';

// Assuming prisma is imported from the server lib
// If this file is used in the frontend, it should only be imported in server actions / API routes
import { prisma } from '../prisma';

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  reason?: string;
}

/**
 * Checks if a proposed timestamp is available for scheduling an outbound call.
 * 
 * Rules checked:
 * 1. Must be within the configured calling hours in the specified timezone (default 9 AM - 9 PM)
 * 2. Must not exceed the max concurrent calls allowed for the agent at that exact minute
 * 3. Must be in the future
 * 
 * @param agentId The ID of the agent making the call
 * @param proposedTimeUtc The proposed time in UTC
 * @param timezone The local timezone of the caller/callee
 * @param maxConcurrent The maximum concurrent calls allowed for this agent (default: 2)
 */
export async function checkAvailability(
  agentId: string,
  proposedTimeUtc: Date,
  timezone: string,
  maxConcurrent: number = 2
): Promise<AvailabilityCheckResult> {
  // Rule 0: Must be in the future
  if (proposedTimeUtc.getTime() <= Date.now()) {
    return {
      isAvailable: false,
      reason: 'Proposed time must be in the future.',
    };
  }

  // Rule 1: Calling hours (9 AM to 9 PM)
  if (!isWithinCallingHours(proposedTimeUtc, timezone, 9, 21)) {
    return {
      isAvailable: false,
      reason: `Proposed time is outside the allowed calling window (09:00 - 21:00) in timezone ${timezone}.`,
    };
  }

  // Rule 2: Concurrency
  // We check how many calls are scheduled within the same minute
  const startOfMinute = new Date(proposedTimeUtc);
  startOfMinute.setSeconds(0, 0);
  
  const endOfMinute = new Date(proposedTimeUtc);
  endOfMinute.setSeconds(59, 999);

  const overlappingCalls = await prisma.scheduledCall.count({
    where: {
      agentId,
      status: { in: ['scheduled', 'in_progress'] },
      scheduledAtUtc: {
        gte: startOfMinute,
        lte: endOfMinute,
      },
    },
  });

  if (overlappingCalls >= maxConcurrent) {
    return {
      isAvailable: false,
      reason: `The agent has reached maximum concurrency (${maxConcurrent}) for this time slot.`,
    };
  }

  return { isAvailable: true };
}
