import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[API] GET /api/admin/clients - Fetching clients');
    const clients = await prisma.client.findMany({
      include: {
        projects: true,
        targets: {
          include: {
            project: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error('[API CLIENTS GET ERROR]:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { name, primaryMail, secondaryMail, optionalMail } = body;

    name = name?.trim() || '';
    primaryMail = primaryMail?.trim()?.toLowerCase() || '';
    secondaryMail = secondaryMail?.trim()?.toLowerCase() || null;
    optionalMail = optionalMail?.trim()?.toLowerCase() || null;

    if (!name || !primaryMail || !secondaryMail) {
      return NextResponse.json({ error: 'Name, Primary Email, and Secondary Email are required' }, { status: 400 });
    }

    if (primaryMail === secondaryMail) {
      return NextResponse.json({ error: 'Primary and Secondary email addresses must be different' }, { status: 400 });
    }

    if (optionalMail && (optionalMail === primaryMail || optionalMail === secondaryMail)) {
      return NextResponse.json({ error: 'Optional Email must be different from Primary and Secondary emails' }, { status: 400 });
    }

    console.log('[API] POST /api/admin/clients - Creating client:', name);
    const client = await prisma.client.create({
      data: {
        name,
        primaryMail,
        secondaryMail: secondaryMail || null,
        optionalMail: optionalMail || null
      }
    });

    console.log(`[API] Success: Client created with ID: ${client.id}`);
    return NextResponse.json(client);
  } catch (error: any) {
    console.error('[API CLIENTS POST ERROR]:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A client with this primary email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
