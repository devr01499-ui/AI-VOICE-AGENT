import { scheduleCall } from './scheduler';

export const bookFollowUpCallTool = {
  name: 'book_follow_up_call',
  executionType: 'builtin' as const,
  config: {},

  description: 'Books a follow-up call with the current caller at a specified future date and time.',
  parameters: {
    type: 'OBJECT',
    properties: {
      proposedTime: {
        type: 'STRING',
        description: 'The proposed future date and time in ISO format (e.g., 2026-08-15T10:00:00Z)',
      },
      timezone: {
        type: 'STRING',
        description: 'The IANA timezone string of the caller (e.g., Asia/Kolkata)',
      }
    },
    required: ['proposedTime', 'timezone'],
  },
};

/**
 * Handles the tool execution from the runtime.
 */
export async function executeBookFollowUpCall(
  agentId: string,
  phoneNumber: string,
  callSessionId: string,
  args: Record<string, unknown>
) {
  try {
    const proposedTime = new Date(args.proposedTime as string);
    const timezone = args.timezone as string || 'Asia/Kolkata';

    if (isNaN(proposedTime.getTime())) {
      return { success: false, reason: 'Invalid proposed time format.' };
    }

    const idempotencyKey = `ai_booked_${callSessionId}_${proposedTime.getTime()}`;

    const booking = await scheduleCall({
      agentId,
      phoneNumber,
      scheduledAtUtc: proposedTime,
      timezone,
      source: 'ai_booked',
      idempotencyKey,
      originCallId: callSessionId,
    });

    return {
      success: true,
      message: 'Booking confirmed successfully.',
      bookingId: booking.id,
      scheduledTime: proposedTime.toISOString(),
      timezone,
    };
  } catch (err: any) {
    // Important: we return success: false with the reason so Gemini can relay it to the user.
    return { success: false, reason: err.message };
  }
}
