import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail, validateAttachments } from '@/lib/email';
import { checkAndIncrementTargets } from '@/lib/target-tracker';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      include: {
        employee: {
          select: { name: true, email: true }
        },
        config: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('Email GET Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status, adminComment, subject, body, to, cc, bcc, scheduledAt } = await request.json();
    
    // Validate email exists and get employee details
    const emailData = await prisma.email.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!emailData) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const token = request.headers.get('authorization')?.split(' ')[1];
    let adminName: string | undefined;
    let adminId: string | undefined;
    if (token) {
      const payload = await verifyToken(token);
      if (payload && payload.role === 'admin') {
        adminId = payload.id;
        const admin = await prisma.admin.findUnique({
          where: { id: payload.id },
          select: { name: true }
        });
        if (admin) {
          adminName = admin.name;
        }
      }
    }

    const finalScheduledAt = scheduledAt !== undefined ? scheduledAt : emailData.scheduledAt;
    const isApproved = status === 'APPROVED';
    const isScheduled = isApproved && finalScheduledAt && new Date(finalScheduledAt).getTime() > Date.now();
    const targetStatus = isScheduled ? 'SCHEDULED' : (isApproved ? 'SENT' : status);

    // Update the email
    const updatedEmail = await prisma.email.update({
      where: { id },
      data: { 
        status: targetStatus, 
        adminComment,
        adminSenderId: adminId || undefined,
        ...(subject && { subject }),
        ...(body && { body }),
        ...(to !== undefined && { to }),
        ...(cc !== undefined && { cc }),
        ...(bcc !== undefined && { bcc }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null })
      },
    });

    // If approved and NOT scheduled for future, send the email immediately via Nodemailer and track targets (asynchronously)
    if (isApproved && !isScheduled) {
      const resolvedTo = to || emailData.to;
      const resolvedSubject = subject || emailData.subject;
      const resolvedBody = body || emailData.body;
      const resolvedCc = cc !== undefined ? cc : emailData.cc;
      const resolvedBcc = bcc !== undefined ? bcc : emailData.bcc;
      
      const attachments = emailData.attachments ? JSON.parse(emailData.attachments) : undefined;

      const attachmentError = validateAttachments(attachments);
      if (attachmentError) {
        return NextResponse.json({ error: attachmentError }, { status: 400 });
      }

      if (!resolvedTo || !resolvedSubject || !resolvedBody) {
        throw new Error('Missing recipient, subject, or body for email delivery.');
      }

      console.log(`[AUTO-SEND] Approving and sending email to: ${resolvedTo}`);
      
      sendEmail(resolvedTo, resolvedSubject, resolvedBody, {
        replyTo: emailData.fromEmail || undefined,
        emailConfigId: emailData.configId || undefined,
        noBcc: false,
        cc: resolvedCc || undefined,
        bcc: resolvedBcc || undefined,
        attachments: attachments,
        senderName: adminName
      }).then(() => {
        console.log('[AUTO-SEND] Nodemailer dispatch success.');
        // Trigger target validation and progression checks (asynchronously)
        checkAndIncrementTargets(resolvedTo, resolvedSubject, resolvedCc, resolvedBcc).catch(trackerErr => {
          console.error('[TRACKER TRACE ERROR]:', trackerErr);
        });
      }).catch(async (sendErr: any) => {
        console.error('[AUTO-SEND ERROR] Background email sending failed:', sendErr.message);
        try {
          await prisma.email.update({
            where: { id },
            data: { 
              status: 'FAILED',
              adminComment: adminComment ? `${adminComment} (Send error: ${sendErr.message})` : `Send error: ${sendErr.message}`
            }
          });
        } catch (dbErr) {
          console.error('[AUTO-SEND DATABASE ERROR]: Failed to mark email status as FAILED', dbErr);
        }
      });
    }

    // Notify employee of status change (asynchronously)
    if (emailData.employee?.email) {
      const subjectLine = isScheduled 
        ? `Request Approved & Scheduled: ${updatedEmail.subject}` 
        : `Request ${isApproved ? 'Approved & Sent' : 'Rejected'}: ${updatedEmail.subject}`;
        
      const bodyText = isScheduled
        ? `Hi ${emailData.employee.name},\n\nYour request for "${updatedEmail.subject}" has been approved and scheduled to send on ${new Date(emailData.scheduledAt!).toLocaleString()}.${adminComment ? `\n\nAdmin Note: ${adminComment}` : ''}`
        : `Hi ${emailData.employee.name},\n\nYour request for "${updatedEmail.subject}" has been ${isApproved ? 'approved and sent' : 'rejected'}.${adminComment ? `\n\nAdmin Note: ${adminComment}` : ''}`;

      sendEmail(
        emailData.employee.email,
        subjectLine,
        bodyText,
        { noBcc: true }
      ).catch((e: any) => {
        console.warn('[NOTIFY ERROR]: Status notification failed', e);
      });
    }

    return NextResponse.json(updatedEmail);
  } catch (error: any) {
    console.error('Email PATCH Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update email',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.email.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete email', details: error.message }, { status: 500 });
  }
}
