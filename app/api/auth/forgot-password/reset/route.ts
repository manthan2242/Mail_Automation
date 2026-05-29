import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let { email, code, newPassword, confirmPassword } = await request.json();
    email = email?.trim()?.toLowerCase();
    const sanitizedCode = code?.trim();

    if (!email || !sanitizedCode || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Verify OTP record exists, matches, and has not expired
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email,
        code: sanitizedCode,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    }

    // OTP matches! Delete it immediately to prevent replay attacks
    await prisma.oTP.delete({ where: { id: otpRecord.id } });

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in the Employee DB table
    await prisma.employee.update({
      where: { email },
      data: {
        password: hashedPassword,
        isFirstLogin: false // Reset isFirstLogin flag since their password has been updated
      }
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('[FORGOT_PASSWORD_RESET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 });
  }
}
