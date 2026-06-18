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

    const { recipientEmail, cc, bcc, subject, body, sourceEmail, configId, attachments, scheduledAt } = await request.json();
    
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

    let adminName: string | undefined;
    if (isAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.id },
        select: { name: true }
      });
      if (admin) {
        adminName = admin.name;
      }
    }

    let emailRecord;
    if (isAdmin) {
      const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now();
      const targetStatus = isScheduled ? 'SCHEDULED' : 'SENT';

      // Step 1: Save to PostgreSQL via Prisma with targetStatus
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
          status: targetStatus,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          attachments: attachments ? JSON.stringify(attachments) : null,
        }
      });
      const targetId = emailRecord.id;
      console.log(`[DATABASE] Success: Saved to DB with ID: ${targetId}`);

      if (!isScheduled) {
        // Step 2: Send real email via Nodemailer asynchronously
        console.log(`[MAIL] Admin sending: Attempting background email via Nodemailer to: ${recipientEmail}`);
        sendEmail(recipientEmail, subject, body, { 
          replyTo: sourceEmail || undefined,
          emailConfigId: configId || undefined,
          cc: cc || undefined,
          bcc: bcc || undefined,
          attachments: attachments || undefined,
          senderName: adminName
        }).then(() => {
          console.log('[MAIL] Success: Email sent successfully via Nodemailer');
          // Trigger target validation and progression checks (asynchronously)
          checkAndIncrementTargets(recipientEmail, subject, cc, bcc).catch(trackerErr => {
            console.error('[TRACKER TRACE ERROR]:', trackerErr);
          });
        }).catch(async (sendErr: any) => {
          console.error('[MAIL ERROR] Background email sending failed:', sendErr.message);
          try {
            await prisma.email.update({
              where: { id: targetId },
              data: { 
                status: 'FAILED',
                adminComment: `Send error: ${sendErr.message}`
              }
            });
          } catch (dbErr) {
            console.error('[MAIL DATABASE ERROR]: Failed to mark email status as FAILED', dbErr);
          }
        });
      }
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
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
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
      ).catch((e: any) => {
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
