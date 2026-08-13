import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../server/src/lib/prisma';
import { getServerSession } from 'next-auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userAgents = await prisma.agent.findMany({
    where: { userId: (session as any).user?.id || (session as any).userId },
    select: { id: true }
  });
  const userAgentIds = userAgents.map((a: any) => a.id);

  const batches = await prisma.batchCampaign.findMany({
    where: { agentId: { in: userAgentIds } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(batches);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  try {
    const batch = await prisma.batchCampaign.create({
      data: {
        name: body.name,
        agentId: body.agentId,
        startAtUtc: new Date(body.startAtUtc),
        timezone: body.timezone,
        pacingPerMinute: body.pacingPerMinute || 5,
        maxConcurrent: body.maxConcurrent || 2,
        totalContacts: body.totalContacts, // In real app, we'd process a list here
        status: body.startAtUtc <= Date.now() ? 'running' : 'scheduled',
      }
    });

    return NextResponse.json(batch);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
