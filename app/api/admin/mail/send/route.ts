import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, status } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Save to history (PostgreSQL)
    console.log('[MAIL TOOL] Saving mail record to AdminMailHistory...');
    const historyItem = await prisma.adminMailHistory.create({
      data: {
        to,
        subject,
        body,
        status: status || 'SENT'
      }
    });
    console.log(`[MAIL TOOL] Saved to DB with ID: ${historyItem.id}`);

    // Step 2: Send real email via Nodemailer (if not a draft)
    if (status !== 'DRAFT') {
      console.log(`[MAIL TOOL] Attempting real Nodemailer delivery to: ${to}`);
      await sendEmail(to, subject, body, undefined, undefined);
      console.log('[MAIL TOOL] Success: Email sent successfully');
    }

    return NextResponse.json({ success: true, message: 'Process completed', historyItem });
  } catch (error: any) {
    console.error("[MAIL TOOL ERROR]:", error.message);
    return NextResponse.json({ error: error.message || 'Failed to process mail tool action' }, { status: 500 });
  }
}
