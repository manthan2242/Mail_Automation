import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { checkAndIncrementTargets } from '@/lib/target-tracker';

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
    const { id, status, adminComment, subject, body, to, cc, bcc } = await request.json();
    
    // Validate email exists and get employee details
    const emailData = await prisma.email.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!emailData) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const isApproved = status === 'APPROVED';
    const targetStatus = isApproved ? 'SENT' : status;

    // Update the email
    const updatedEmail = await prisma.email.update({
      where: { id },
      data: { 
        status: targetStatus, 
        adminComment,
        ...(subject && { subject }),
        ...(body && { body }),
        ...(to !== undefined && { to }),
        ...(cc !== undefined && { cc }),
        ...(bcc !== undefined && { bcc })
      },
    });

    // If approved, send the email immediately via Nodemailer and track targets
    if (isApproved) {
      const resolvedTo = to || emailData.to;
      const resolvedSubject = subject || emailData.subject;
      const resolvedBody = body || emailData.body;
      const resolvedCc = cc !== undefined ? cc : emailData.cc;
      const resolvedBcc = bcc !== undefined ? bcc : emailData.bcc;
      
      const attachments = emailData.attachments ? JSON.parse(emailData.attachments) : undefined;

      if (!resolvedTo || !resolvedSubject || !resolvedBody) {
        throw new Error('Missing recipient, subject, or body for email delivery.');
      }

      console.log(`[AUTO-SEND] Approving and sending email to: ${resolvedTo}`);
      await sendEmail(resolvedTo, resolvedSubject, resolvedBody, {
        replyTo: emailData.fromEmail || undefined,
        emailConfigId: emailData.configId || undefined,
        noBcc: false,
        cc: resolvedCc || undefined,
        bcc: resolvedBcc || undefined,
        attachments: attachments
      });
      console.log('[AUTO-SEND] Nodemailer dispatch success.');

      // Trigger target validation and progression checks (asynchronously)
      checkAndIncrementTargets(resolvedTo, resolvedSubject, resolvedCc, resolvedBcc).catch(trackerErr => {
        console.error('[TRACKER TRACE ERROR]:', trackerErr);
      });
    }

    // Notify employee of status change (asynchronously)
    if (emailData.employee?.email) {
      sendEmail(
        emailData.employee.email,
        `Request ${isApproved ? 'Approved & Sent' : 'Rejected'}: ${updatedEmail.subject}`,
        `Hi ${emailData.employee.name},\n\nYour request for "${updatedEmail.subject}" has been ${isApproved ? 'approved and sent' : 'rejected'}.${adminComment ? `\n\nAdmin Note: ${adminComment}` : ''}`,
        { noBcc: true }
      ).catch((e) => {
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
