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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { name: true }
    });
    const adminName = admin?.name;

    const { to, cc, bcc, subject, body, status, configId } = await request.json();

    // Validate TO field
    if (!to || !Array.isArray(to) || to.length === 0 || !subject || !body) {
      return NextResponse.json({ error: 'Missing or invalid required fields. TO must be an array with at least one email.' }, { status: 400 });
    }

    // Validate CC field (optional but if provided, must be array)
    if (cc && !Array.isArray(cc)) {
      return NextResponse.json({ error: 'CC must be an array' }, { status: 400 });
    }

    // Validate BCC field (optional but if provided, must be array)
    if (bcc && !Array.isArray(bcc)) {
      return NextResponse.json({ error: 'BCC must be an array' }, { status: 400 });
    }

    // Step 1: Save to history (PostgreSQL)
    console.log('[MAIL TOOL] Saving mail record to AdminMailHistory...');
    const historyItem = await prisma.adminMailHistory.create({
      data: {
        to: to.join(', '),
        cc: cc && cc.length > 0 ? cc.join(', ') : null,
        bcc: bcc && bcc.length > 0 ? bcc.join(', ') : null,
        subject,
        body,
        status: status || 'SENT'
      }
    });
    const historyId = historyItem.id;
    console.log(`[MAIL TOOL] Saved to DB with ID: ${historyId}`);

    // Step 2: Send real email via Nodemailer (if not a draft) (asynchronously)
    if (status !== 'DRAFT') {
      console.log(`[MAIL TOOL] Attempting real Nodemailer delivery to: ${to.join(', ')}`);
      sendEmail(to, subject, body, { cc: cc || [], bcc: bcc || [], senderName: adminName }, configId)
        .then(() => {
          console.log('[MAIL TOOL] Success: Email sent successfully');
          // Trigger target validation and progression checks (asynchronously)
          checkAndIncrementTargets(
            to.join(', '),
            subject,
            cc && cc.length > 0 ? cc.join(', ') : undefined,
            bcc && bcc.length > 0 ? bcc.join(', ') : undefined
          ).catch(trackerErr => {
            console.error('[TRACKER TRACE ERROR]:', trackerErr);
          });
        })
        .catch(async (sendErr: any) => {
          console.error('[MAIL TOOL ERROR] Background email sending failed:', sendErr.message);
          try {
            await prisma.adminMailHistory.update({
              where: { id: historyId },
              data: { status: 'FAILED' }
            });
          } catch (dbErr) {
            console.error('[MAIL TOOL DATABASE ERROR]: Failed to mark mail history as FAILED', dbErr);
          }
        });
    }

    return NextResponse.json({ success: true, message: 'Process completed', historyItem });
  } catch (error: any) {
    console.error("[MAIL TOOL ERROR]:", error.message);
    return NextResponse.json({ error: error.message || 'Failed to process mail tool action' }, { status: 500 });
  }
}
