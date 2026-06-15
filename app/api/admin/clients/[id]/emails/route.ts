import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            shortName: true,
            shortName2: true
          }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientEmails: string[] = [];
    if (client.primaryMail) clientEmails.push(client.primaryMail.trim().toLowerCase());
    if (client.secondaryMail) {
      client.secondaryMail.split(',').forEach(e => {
        const trimmed = e.trim().toLowerCase();
        if (trimmed) clientEmails.push(trimmed);
      });
    }
    if (client.optionalMail) {
      client.optionalMail.split(',').forEach(e => {
        const trimmed = e.trim().toLowerCase();
        if (trimmed) clientEmails.push(trimmed);
      });
    }

    const allEmails = await prisma.email.findMany({
      include: {
        employee: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const getEmailsFromString = (str: string | null | undefined): string[] => {
      if (!str) return [];
      return str
        .split(',')
        .map(email => {
          const clean = email.trim();
          const match = /<([^>]+)>/.exec(clean);
          return (match ? match[1] : clean).trim().toLowerCase();
        })
        .filter(Boolean);
    };

    // Filter emails that have at least one recipient matching the client's email addresses
    const filteredEmails = allEmails.filter(email => {
      const toEmails = getEmailsFromString(email.to);
      const ccEmails = getEmailsFromString(email.cc);
      const bccEmails = getEmailsFromString(email.bcc);
      const allRecipients = [...toEmails, ...ccEmails, ...bccEmails];

      return allRecipients.some(rec => clientEmails.includes(rec));
    });

    return NextResponse.json({
      client,
      emails: filteredEmails
    });
  } catch (error: any) {
    console.error('Fetch client emails error:', error);
    return NextResponse.json({ error: 'Failed to fetch client emails', details: error.message }, { status: 500 });
  }
}
