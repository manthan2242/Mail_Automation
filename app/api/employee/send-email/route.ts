import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipientEmail, subject, body, sourceEmail } = await request.json();
    
    if (!sourceEmail || sourceEmail.trim() === "") {
        return NextResponse.json({ error: 'Source email is required' }, { status: 400 });
    }

    if (!recipientEmail || !subject || !body) {
      return NextResponse.json({ error: 'Missing recipient, subject or body' }, { status: 400 });
    }

    // Step 1: Send real email via Nodemailer (using the common utility)
    console.log(`[MAIL] Attempting to send email via Nodemailer to: ${recipientEmail}`);
    await sendEmail(recipientEmail, subject, body, sourceEmail);
    console.log('[MAIL] Success: Email sent successfully via Nodemailer');

    // Step 2: Save to PostgreSQL via Prisma
    console.log('[DATABASE] Saving email record to DB...');
    const emailRecord = await prisma.email.create({
      data: {
        to: recipientEmail,
        fromEmail: sourceEmail,
        subject,
        body,
        ...(payload.role === 'admin' ? { adminSenderId: payload.id } : { senderId: payload.id }),
        status: 'SENT',
      }
    });
    console.log(`[DATABASE] Success: Saved to DB with ID: ${emailRecord.id}`);

    return NextResponse.json({ success: true, message: 'Email sent and saved successfully', email: emailRecord });
  } catch (error: any) {
    console.error('[FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process email delivery' }, { status: 500 });
  }
}
