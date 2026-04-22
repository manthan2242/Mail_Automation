import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { APP_CONFIG, AUTH_CONFIG, EMAIL_SUBJECTS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();
    
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Valid for configured minutes
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.oTP.create({
      data: {
        email: employee.email,
        code: otpCode,
        expiresAt,
      },
    });

    const smtpConfig = await prisma.emailConfig.findFirst();

    await sendEmail(
      employee.email,
      EMAIL_SUBJECTS.OTP(APP_CONFIG.NAME),
      `Your one-time password (OTP) is: ${otpCode}. It will expire in ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
      undefined,
      smtpConfig?.id
    );

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
