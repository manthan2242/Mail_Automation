import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { shouldReset } from '@/lib/target-tracker';

export async function GET() {
  try {
    console.log('[API] GET /api/admin/targets - Fetching and validating targets');
    
    // Fetch all targets to check if any have expired their period
    const targetsToVerify = await prisma.target.findMany();
    
    // Perform dynamic auto-reset check
    const now = new Date();
    for (const t of targetsToVerify) {
      if (shouldReset(t.frequency, t.lastReset)) {
        await prisma.target.update({
          where: { id: t.id },
          data: {
            currentCount: 0,
            isCompleted: false,
            lastReset: now
          }
        });
      }
    }

    // Retrieve refreshed list with relations
    const targets = await prisma.target.findMany({
      include: {
        client: true,
        project: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(targets);
  } catch (error) {
    console.error('[API TARGETS GET ERROR]:', error);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, projectId, mailCount, frequency } = body;

    const countVal = parseInt(mailCount);
    if (!clientId || !projectId || isNaN(countVal) || countVal <= 0 || !frequency) {
      return NextResponse.json({ error: 'Missing or invalid fields: clientId, projectId, mailCount, frequency' }, { status: 400 });
    }

    // Verify client and project exist
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[API] POST /api/admin/targets - Creating target');
    const target = await prisma.target.create({
      data: {
        clientId,
        projectId,
        mailCount: countVal,
        frequency,
        currentCount: 0,
        isCompleted: false,
        lastReset: new Date()
      },
      include: {
        client: true,
        project: true
      }
    });

    return NextResponse.json(target);
  } catch (error: any) {
    console.error('[API TARGETS POST ERROR]:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A target configuration already exists for this client-project mapping' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
  }
}
