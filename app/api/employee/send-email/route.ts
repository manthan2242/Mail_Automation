import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail, validateAttachments } from '@/lib/email';
import { NextResponse } from 'next/server';
import { checkAndIncrementTargets } from '@/lib/target-tracker';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipientEmail, cc, bcc, subject, body, sourceEmail, configId, attachments } = await request.json();
    
    if (!sourceEmail || sourceEmail.trim() === "") {
        return NextResponse.json({ error: 'Source email is required' }, { status: 400 });
    }

    if (!recipientEmail || !subject || !body) {
      return NextResponse.json({ error: 'Missing recipient, subject or body' }, { status: 400 });
    }

    const attachmentError = validateAttachments(attachments);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 });
    }

    const isAdmin = payload.role === 'admin';

    let emailRecord;
    if (isAdmin) {
      // Step 1: Send real email via Nodemailer immediately for admins
      console.log(`[MAIL] Admin sending: Attempting to send email via Nodemailer to: ${recipientEmail}`);
      await sendEmail(recipientEmail, subject, body, { 
        replyTo: sourceEmail || undefined,
        emailConfigId: configId || undefined,
        cc: cc || undefined,
        bcc: bcc || undefined,
        attachments: attachments || undefined
      });
      console.log('[MAIL] Success: Email sent successfully via Nodemailer');

      // Step 2: Save to PostgreSQL via Prisma with SENT status
      console.log('[DATABASE] Saving email record to DB...');
      emailRecord = await prisma.email.create({
        data: {
          to: recipientEmail,
          cc: cc || null,
          bcc: bcc || null,
          fromEmail: sourceEmail,
          subject,
          body,
          adminSenderId: payload.id,
          configId: configId || null,
          status: 'SENT',
          attachments: attachments ? JSON.stringify(attachments) : null,
        }
      });
      console.log(`[DATABASE] Success: Saved to DB with ID: ${emailRecord.id}`);

      // Trigger target validation and progression checks (asynchronously)
      checkAndIncrementTargets(recipientEmail, subject, cc, bcc).catch(trackerErr => {
        console.error('[TRACKER TRACE ERROR]:', trackerErr);
      });
    } else {
      // For employees, save as PENDING for admin approval
      console.log('[DATABASE] Employee sending: Saving pending email record to DB...');
      emailRecord = await prisma.email.create({
        data: {
          to: recipientEmail,
          cc: cc || null,
          bcc: bcc || null,
          fromEmail: sourceEmail,
          subject,
          body,
          senderId: payload.id,
          configId: configId || null,
          status: 'PENDING',
          attachments: attachments ? JSON.stringify(attachments) : null,
        }
      });
      console.log(`[DATABASE] Success: Saved pending email to DB with ID: ${emailRecord.id}`);

      // Send a copy to the employee for their records (asynchronously)
      sendEmail(
        payload.email,
        `Draft Submitted: ${subject}`,
        `Hi ${(payload as any).name || 'Employee'},\n\nYour request for "${subject}" has been submitted for review.`,
        { noBcc: true }
      ).catch((e) => {
        console.warn('[NOTIFY ERROR]: Could not send submission copy to employee', e);
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: isAdmin ? 'Email sent and saved successfully' : 'Email submitted for approval', 
      email: emailRecord 
    });
  } catch (error: any) {
    console.error('[FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process email delivery' }, { status: 500 });
  }
}
