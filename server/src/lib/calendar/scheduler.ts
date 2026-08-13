import { prisma } from '../prisma';
import { checkAvailability } from './availability';

export interface CreateBookingInput {
  agentId: string;
  phoneNumber: string;
  scheduledAtUtc: Date;
  timezone: string;
  source: string;
  batchId?: string;
  idempotencyKey: string;
  originCallId?: string;
  notes?: string;
  maxConcurrent?: number;
}

/**
 * Creates a new ScheduledCall entry after validating availability.
 */
export async function scheduleCall(input: CreateBookingInput) {
  // Validate availability
  const availability = await checkAvailability(
    input.agentId,
    input.scheduledAtUtc,
    input.timezone,
    input.maxConcurrent || 2
  );

  if (!availability.isAvailable) {
    throw new Error(`Time slot unavailable: ${availability.reason}`);
  }

  // Idempotency check
  const existing = await prisma.scheduledCall.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return existing;
  }

  return await prisma.scheduledCall.create({
    data: {
      agentId: input.agentId,
      phoneNumber: input.phoneNumber,
      scheduledAtUtc: input.scheduledAtUtc,
      timezone: input.timezone,
      source: input.source,
      batchId: input.batchId,
      idempotencyKey: input.idempotencyKey,
      originCallId: input.originCallId,
      notes: input.notes,
      status: 'scheduled',
    },
  });
}

export async function cancelBooking(id: string) {
  return await prisma.scheduledCall.update({
    where: { id },
    data: { status: 'canceled' },
  });
}

export async function rescheduleBooking(id: string, newTimeUtc: Date, timezone: string, maxConcurrent = 2) {
  const booking = await prisma.scheduledCall.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');

  const availability = await checkAvailability(booking.agentId, newTimeUtc, timezone, maxConcurrent);
  if (!availability.isAvailable) {
    throw new Error(`Time slot unavailable: ${availability.reason}`);
  }

  return await prisma.scheduledCall.update({
    where: { id },
    data: {
      scheduledAtUtc: newTimeUtc,
      timezone,
      status: 'scheduled',
      attemptCount: 0,
      lastAttemptAt: null,
    },
  });
}
