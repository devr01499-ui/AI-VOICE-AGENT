import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../server/src/lib/prisma';
import { getServerSession } from 'next-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowedStatuses = ['running', 'paused', 'canceled'];

  if (body.status && !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const batch = await prisma.batchCampaign.update({
        where: { id },
        data: {
            status: body.status
        }
    });

    // If canceled, also cancel pending scheduled calls
    if (body.status === 'canceled') {
        await prisma.scheduledCall.updateMany({
            where: { batchId: id, status: 'scheduled' },
            data: { status: 'canceled' }
        });
    }

    return NextResponse.json(batch);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
