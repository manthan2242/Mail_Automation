import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { APP_CONFIG, EMAIL_SUBJECTS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bodyData = await request.json();
    let { to, subject, body, fromEmail, configId, emailId } = bodyData;

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
        if (record.employee) {
          employeeToNotify = { email: record.employee.email, name: record.employee.name };
        }
      } else {
        return NextResponse.json({ error: 'Email record not found' }, { status: 404 });
      }
    }

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Step 1: Send real email via Nodemailer
    console.log(`[ADMIN MAIL] Attempting delivery to: ${to}`);
    await sendEmail(to, subject, body, fromEmail, configId);
    console.log('[ADMIN MAIL] Success: Email dispatched');

    // Notify employee that their mail has been sent
    if (employeeToNotify) {
      try {
        await sendEmail(
          employeeToNotify.email,
          `${EMAIL_SUBJECTS.EMAIL_SENT_NOTIFICATION}${subject}`,
          `Hi ${employeeToNotify.name},\n\nYour request for "${subject}" has been sent and delivered.`,
          undefined,
          undefined,
          true // noBcc: true
        );
      } catch (e) {
        console.warn('[NOTIFY ERROR]: Post-dispatch notification failed', e);
      }
    }

    // Step 2: Update existing record or save new one
    console.log('[DATABASE] Updating email persistence...');
    let emailRecord;
    
    if (emailId) {
      emailRecord = await prisma.email.update({
        where: { id: emailId },
        data: { status: 'SENT' }
      });
    } else {
      emailRecord = await prisma.email.create({
        data: {
          to,
          fromEmail: fromEmail || process.env.EMAIL_USER || APP_CONFIG.SYSTEM_EMAIL,
          subject,
          body,
          status: 'SENT',
          adminSenderId: payload.id
        }
      });
    }
    console.log(`[DATABASE] Success: Sync complete for ${emailRecord.id}`);

    return NextResponse.json({ success: true, message: 'Email sent successfully', email: emailRecord });
  } catch (error: any) {
    console.error('[ADMIN FLOW ERROR]:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to process admin email' }, { status: 500 });
  }
}
