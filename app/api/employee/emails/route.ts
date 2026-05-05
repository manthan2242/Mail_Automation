import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const emails = await prisma.email.findMany({
      where: {
        OR: [
          { senderId: payload.id },
          { fromEmail: payload.email },
          { to: payload.email }
        ]
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(emails);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { to, cc, bcc, subject, body, fromEmail, configId } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    // Save email as PENDING for admin approval
    const email = await prisma.email.create({
      data: {
        to: to || null,
        cc: cc || null,
        bcc: bcc || null,
        fromEmail: fromEmail || null,
        subject,
        body,
        senderId: payload.id,
        configId: configId || null,
        status: 'PENDING',
      },
    });

    // Send a copy to the employee for their records
    const { sendEmail } = require('@/lib/email');
    try {
      await sendEmail(
        payload.email,
        `Draft Submitted: ${subject}`,
        `Hi ${(payload as any).name || 'Employee'},\n\nYour request for "${subject}" has been submitted for review.`,
        undefined,
        undefined,
        true // noBcc: true
      );
    } catch (e) {
      console.warn('[NOTIFY ERROR]: Could not send submission copy to employee', e);
    }

    return NextResponse.json(email);
  } catch (error) {
    console.error('Failed to submit email:', error);
    return NextResponse.json({ error: 'Failed to submit email' }, { status: 500 });
  }
}
