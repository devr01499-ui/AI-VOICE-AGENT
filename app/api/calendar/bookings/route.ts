import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../server/src/lib/prisma';
import { getServerSession } from 'next-auth';
import { scheduleCall } from '../../../../server/src/lib/calendar/scheduler';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  // Assume authentication middleware handled missing sessions or we return 401
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');

  const where: any = {};
  if (agentId) where.agentId = agentId;

  // We should ideally filter by user's agents, but for brevity, we assume dashboard will 
  // query for agents owned by the user. Let's add basic security.
  const userAgents = await prisma.agent.findMany({
    where: { userId: (session as any).user?.id || (session as any).userId },
    select: { id: true }
  });
  const userAgentIds = userAgents.map((a: any) => a.id);

  if (agentId && !userAgentIds.includes(agentId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!agentId) {
    where.agentId = { in: userAgentIds };
  }

  const bookings = await prisma.scheduledCall.findMany({
    where,
    orderBy: { scheduledAtUtc: 'asc' },
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  try {
    const booking = await scheduleCall({
      agentId: body.agentId,
      phoneNumber: body.phoneNumber,
      scheduledAtUtc: new Date(body.scheduledAtUtc),
      timezone: body.timezone,
      source: 'manual',
      idempotencyKey: `manual_${Date.now()}_${body.phoneNumber}`,
      notes: body.notes,
    });

    return NextResponse.json(booking);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
