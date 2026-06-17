import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { sendEmail, validateAttachments } from '@/lib/email';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Fetch only the logged-in employee's own emails
    const emails = await prisma.email.findMany({
      where: {
        senderId: payload.id
      },
      include: {
        employee: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(emails);
  } catch (error) {
    console.error('Fetch employee emails error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { to, cc, bcc, subject, body, fromEmail, configId, attachments } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const attachmentError = validateAttachments(attachments);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 });
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
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
    });

    // Send a copy to the employee for their records (asynchronously)
    sendEmail(
      payload.email,
      `Draft Submitted: ${subject}`,
      `Hi ${(payload as any).name || 'Employee'},\n\nYour request for "${subject}" has been submitted for review.`,
      { noBcc: true }
    ).catch((e: any) => {
      console.warn('[NOTIFY ERROR]: Could not send submission copy to employee', e);
    });

    return NextResponse.json(email);
  } catch (error) {
    console.error('Failed to submit email:', error);
    return NextResponse.json({ error: 'Failed to submit email' }, { status: 500 });
  }
}
