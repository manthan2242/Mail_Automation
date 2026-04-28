import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

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

    // Valid for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oTP.create({
      data: {
        email: employee.email,
        code: otpCode,
        expiresAt,
      },
    });

    await sendEmail(
      employee.email,
      'Login OTP - Mail Automation',
      `Your one-time password (OTP) is: ${otpCode}. It will expire in 10 minutes.`,
      undefined,
      undefined
    );

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
