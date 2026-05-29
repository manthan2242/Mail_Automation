import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let { email } = await request.json();
    email = email?.trim()?.toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) {
      return NextResponse.json({ error: 'No employee account found with this email' }, { status: 404 });
    }

    // Rate limiting: check for any active OTP created in the last 60 seconds
    const latestOtp = await prisma.oTP.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

    if (latestOtp && latestOtp.createdAt > sixtySecondsAgo) {
      return NextResponse.json({ error: 'Please wait 60 seconds before requesting a new code' }, { status: 429 });
    }

    // Generate secure 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Send reset OTP to employee email
    await sendEmail(
      email,
      'Password Reset Request - OTP Verification',
      `Your security OTP verification code for resetting your password is: ${code}. This code will expire in 5 minutes.`,
      { noBcc: true }
    );

    // Save to DB
    await prisma.oTP.create({
      data: {
        email,
        code,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000)
      }
    });

    return NextResponse.json({ success: true, message: 'Reset code sent to your email' });
  } catch (error: any) {
    console.error('[FORGOT_PASSWORD_REQUEST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to request reset OTP' }, { status: 500 });
  }
}
