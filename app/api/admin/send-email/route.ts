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
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { name: true }
    });
    const adminName = admin?.name;

    const bodyData = await request.json();
    let { to, cc, bcc, subject, body, fromEmail, configId, emailId, attachments, scheduledAt } = bodyData;

    const attachmentError = validateAttachments(attachments);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 });
    }

    // Validate fields & resolve variables
    let resolvedTo = to;
    let resolvedSubject = subject;
    let resolvedBody = body;
    let resolvedCc = cc;
    let resolvedBcc = bcc;
    let resolvedAttachments = attachments;
    let employeeToNotify: { email: string, name: string } | null = null;
    let recordAttachments: any = undefined;

    if (emailId) {
      console.log(`[ADMIN] Fetching approved email record: ${emailId}`);
      const record = await prisma.email.findUnique({ 
        where: { id: emailId },
        include: { employee: true }
      });
      if (!record) {
        return NextResponse.json({ error: 'Email record not found' }, { status: 404 });
      }

      resolvedTo = to || record.to;
      resolvedSubject = subject || record.subject;
      resolvedBody = body || record.body;
      resolvedCc = cc || record.cc || undefined;
      resolvedBcc = bcc || record.bcc || undefined;
      
      if (record.employee) {
        employeeToNotify = { email: record.employee.email, name: record.employee.name };
      }

      recordAttachments = record.attachments ? JSON.parse(record.attachments) : undefined;
      const recordAttachmentError = validateAttachments(recordAttachments);
      if (recordAttachmentError) {
        return NextResponse.json({ error: recordAttachmentError }, { status: 400 });
      }
      resolvedAttachments = recordAttachments;
    } else {
      if (!resolvedTo || !resolvedSubject || !resolvedBody) {
        return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
      }
      const attachmentError = validateAttachments(resolvedAttachments);
      if (attachmentError) {
        return NextResponse.json({ error: attachmentError }, { status: 400 });
      }
    }

    // Step 2: Update existing record or save new one (FIRST, so we can return response fast)
    console.log('[DATABASE] Updating email persistence...');
    let emailRecord;
    const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now();
    const targetStatus = isScheduled ? 'SCHEDULED' : 'SENT';

    if (emailId) {
      emailRecord = await prisma.email.update({
        where: { id: emailId },
        data: { 
          status: targetStatus,
          configId: configId || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
        }
      });
    } else {
      emailRecord = await prisma.email.create({
        data: {
          to: resolvedTo,
          cc: resolvedCc || null,
          bcc: resolvedBcc || null,
          fromEmail: fromEmail || process.env.EMAIL_USER || 'admin@system.com',
          subject: resolvedSubject,
          body: resolvedBody,
          status: targetStatus,
          adminSenderId: payload.id,
          configId: configId || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          attachments: resolvedAttachments ? JSON.stringify(resolvedAttachments) : null
        }
      });
    }
    const targetRecordId = emailRecord.id;
    console.log(`[DATABASE] Success: Sync complete for ${targetRecordId}`);

    if (!isScheduled) {
      // Trigger SMTP send in the background (asynchronously)
      console.log(`[ADMIN MAIL] Triggering background delivery to: ${resolvedTo}`);
      sendEmail(resolvedTo, resolvedSubject, resolvedBody, {
        replyTo: fromEmail || undefined,
        emailConfigId: configId || undefined,
        noBcc: false,
        cc: resolvedCc,
        bcc: resolvedBcc,
        attachments: resolvedAttachments || undefined,
        senderName: adminName
      }).then(() => {
        console.log('[ADMIN MAIL] Success: Email dispatched');
        // Trigger target validation and progression checks (asynchronously)
        checkAndIncrementTargets(resolvedTo, resolvedSubject, resolvedCc, resolvedBcc).catch(trackerErr => {
          console.error('[TRACKER TRACE ERROR]:', trackerErr);
        });
      }).catch(async (sendErr: any) => {
        console.error('[ADMIN MAIL ERROR] Background email sending failed:', sendErr.message);
        try {
          await prisma.email.update({
            where: { id: targetRecordId },
            data: { 
              status: 'FAILED',
              adminComment: `Send error: ${sendErr.message}`
            }
          });
        } catch (dbErr) {
          console.error('[ADMIN MAIL DATABASE ERROR]: Failed to mark email status as FAILED', dbErr);
        }
      });
    }

    // Notify employee that their mail has been sent (asynchronously)
    if (employeeToNotify) {
      sendEmail(
        employeeToNotify.email,
        `Email Sent: ${resolvedSubject}`,
        `Hi ${employeeToNotify.name},\n\nYour request for "${resolvedSubject}" has been sent and delivered.`,
        { noBcc: true }
      ).catch((e: any) => {
        console.warn('[NOTIFY ERROR]: Post-dispatch notification failed', e);
      });
    }

    return NextResponse.json({ success: true, message: 'Email sent successfully', email: emailRecord });
  } catch (error: any) {
    console.error('[ADMIN FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process admin email' }, { status: 500 });
  }
}
