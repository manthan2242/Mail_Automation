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
    let { name, primaryMail, secondaryMail, optionalMail, optionalMails } = body;

    name = name?.trim() || '';
    primaryMail = primaryMail?.trim()?.toLowerCase() || '';

    let emails: string[] = [];
    if (Array.isArray(optionalMails)) {
      emails = optionalMails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean);
    } else {
      if (secondaryMail) emails.push(secondaryMail.trim().toLowerCase());
      if (optionalMail) {
        optionalMail.split(',').forEach((e: string) => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) emails.push(trimmed);
        });
      }
    }

    // Ensure uniqueness of optional emails
    const uniqueEmails = Array.from(new Set(emails));
    const secMail = uniqueEmails[0] || null;
    const optMail = uniqueEmails.length > 1 ? uniqueEmails.slice(1).join(', ') : null;

    if (!name || !primaryMail) {
      return NextResponse.json({ error: 'Name and Primary Email are required' }, { status: 400 });
    }

    if (uniqueEmails.includes(primaryMail)) {
      return NextResponse.json({ error: 'Optional email addresses must be different from the Primary email address' }, { status: 400 });
    }

    console.log('[API] POST /api/admin/clients - Creating client:', name);
    const client = await prisma.client.create({
      data: {
        name,
        primaryMail,
        secondaryMail: secMail,
        optionalMail: optMail
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
