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
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bodyData = await request.json();
    let { to, cc, bcc, subject, body, fromEmail, configId, emailId, attachments } = bodyData;

    // If emailId is provided, fetch the approved draft from the database
    let employeeToNotify: { email: string, name: string } | null = null;
    if (emailId) {
      console.log(`[ADMIN] Fetching approved email record: ${emailId}`);
      const record = await prisma.email.findUnique({ 
        where: { id: emailId },
        include: { employee: true }
      });
      if (record) {
        to = to || record.to;
        subject = subject || record.subject;
        body = body || record.body;
        // Capture cc/bcc from record if available
        cc = cc || record.cc || undefined;
        bcc = bcc || record.bcc || undefined;
        
        if (record.employee) {
          employeeToNotify = { email: record.employee.email, name: record.employee.name };
        }

        const recordAttachments = record.attachments ? JSON.parse(record.attachments) : undefined;
        // Send via Nodemailer with cc/bcc and attachments
        console.log(`[ADMIN MAIL] Attempting delivery to: ${to}`);
        await sendEmail(to, subject, body, {
          replyTo: fromEmail || undefined,
          emailConfigId: configId || undefined,
          noBcc: false,
          cc: cc,
          bcc: bcc,
          attachments: recordAttachments
        });
        console.log('[ADMIN MAIL] Success: Email dispatched');
      } else {
        return NextResponse.json({ error: 'Email record not found' }, { status: 404 });
      }
    } else {
      // Direct send from admin tool
      if (!to || !subject || !body) {
        return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
      }
      console.log(`[ADMIN MAIL] Direct delivery to: ${to}`);
      await sendEmail(to, subject, body, {
        replyTo: fromEmail || undefined,
        emailConfigId: configId || undefined,
        noBcc: false,
        cc: cc,
        bcc: bcc,
        attachments: attachments || undefined
      });
    }

    // Notify employee that their mail has been sent (asynchronously)
    if (employeeToNotify) {
      sendEmail(
        employeeToNotify.email,
        `Email Sent: ${subject}`,
        `Hi ${employeeToNotify.name},\n\nYour request for "${subject}" has been sent and delivered.`,
        { noBcc: true }
      ).catch((e) => {
        console.warn('[NOTIFY ERROR]: Post-dispatch notification failed', e);
      });
    }

    // Step 2: Update existing record or save new one
    console.log('[DATABASE] Updating email persistence...');
    let emailRecord;
    if (emailId) {
      emailRecord = await prisma.email.update({
        where: { id: emailId },
        data: { 
          status: 'SENT',
          configId: configId || undefined
        }
      });
    } else {
      emailRecord = await prisma.email.create({
        data: {
          to,
          cc: cc || null,
          bcc: bcc || null,
          fromEmail: fromEmail || process.env.EMAIL_USER || 'admin@system.com',
          subject,
          body,
          status: 'SENT',
          adminSenderId: payload.id,
          configId: configId || undefined,
          attachments: attachments ? JSON.stringify(attachments) : null
        }
      });
    }
    console.log(`[DATABASE] Success: Sync complete for ${emailRecord.id}`);

    // Trigger target validation and progression checks (asynchronously)
    checkAndIncrementTargets(to, subject, cc, bcc).catch(trackerErr => {
      console.error('[TRACKER TRACE ERROR]:', trackerErr);
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully', email: emailRecord });
  } catch (error: any) {
    console.error('[ADMIN FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process admin email' }, { status: 500 });
  }
}
