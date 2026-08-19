import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../server/src/lib/prisma';
import { getServerSession } from 'next-auth';
import { cancelBooking, rescheduleBooking } from '../../../../../server/src/lib/calendar/scheduler';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const booking = await prisma.scheduledCall.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  try {
    let booking;
    if (body.action === 'cancel') {
      booking = await cancelBooking(id);
    } else if (body.action === 'reschedule') {
      booking = await rescheduleBooking(id, new Date(body.scheduledAtUtc), body.timezone);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(booking);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
