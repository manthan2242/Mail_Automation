import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { checkAndIncrementTargets } from '@/lib/target-tracker';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipientEmail, cc, bcc, subject, body, sourceEmail, configId } = await request.json();
    
    if (!sourceEmail || sourceEmail.trim() === "") {
        return NextResponse.json({ error: 'Source email is required' }, { status: 400 });
    }

    if (!recipientEmail || !subject || !body) {
      return NextResponse.json({ error: 'Missing recipient, subject or body' }, { status: 400 });
    }

    // Step 1: Send real email via Nodemailer (using the common utility)
    console.log(`[MAIL] Attempting to send email via Nodemailer to: ${recipientEmail}`);
    await sendEmail(recipientEmail, subject, body, { 
      replyTo: sourceEmail || undefined,
      emailConfigId: configId || undefined,
      cc: cc || undefined,
      bcc: bcc || undefined
    });
    console.log('[MAIL] Success: Email sent successfully via Nodemailer');

    // Step 2: Save to PostgreSQL via Prisma
    console.log('[DATABASE] Saving email record to DB...');
    const emailRecord = await prisma.email.create({
      data: {
        to: recipientEmail,
        cc: cc || null,
        bcc: bcc || null,
        fromEmail: sourceEmail,
        subject,
        body,
        ...(payload.role === 'admin' ? { adminSenderId: payload.id } : { senderId: payload.id }),
        configId: configId || null,
        status: 'SENT',
      }
    });
    console.log(`[DATABASE] Success: Saved to DB with ID: ${emailRecord.id}`);

    // Trigger target validation and progression checks
    try {
      await checkAndIncrementTargets(recipientEmail, subject);
    } catch (trackerErr) {
      console.error('[TRACKER TRACE ERROR]:', trackerErr);
    }

    return NextResponse.json({ success: true, message: 'Email sent and saved successfully', email: emailRecord });
  } catch (error: any) {
    console.error('[FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process email delivery' }, { status: 500 });
  }
}
