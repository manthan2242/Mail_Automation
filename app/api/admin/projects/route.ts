import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { client: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { name, shortName, shortName2, clientId } = body;

    name = name?.trim() || '';
    shortName = shortName?.trim() || null;
    shortName2 = shortName2?.trim() || null;

    if (!name || !clientId) {
      return NextResponse.json({ error: 'Project Name and Client ID are required' }, { status: 400 });
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    console.log('[API] POST /api/admin/projects - Adding project:', name);
    const project = await prisma.project.create({
      data: {
        name,
        shortName: shortName || null,
        shortName2: shortName2 || null,
        clientId
      }
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('[API PROJECTS POST ERROR]:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A project with this name already exists for this client' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
