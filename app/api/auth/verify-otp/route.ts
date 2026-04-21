import { prisma } from '@/lib/db';
import { verifyToken, signToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { code } = await request.json();
    const sanitizedCode = code.trim();

    console.log(`Verifying OTP for ${payload.email}: Code ${sanitizedCode}`);

    // Enforce OTP checking strictly
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: payload.email,
        code: sanitizedCode,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      console.log('OTP not found or expired for email:', payload.email);
      // Logic for failed Attempts counting can be placed here matching Admin table
      if (payload.role === 'admin') {
        const admin = await prisma.admin.findUnique({ where: { email: payload.email } });
        if (admin) {
           await prisma.admin.update({ 
             where: { id: admin.id }, 
             data: { failedAttempts: admin.failedAttempts + 1 } 
           });
        }
      }
      return NextResponse.json({ error: 'Invalid or expired OTP. Please try again or request a new one.' }, { status: 400 });
    }

    console.log('OTP verified successfully!');
    // Delete OTP after successful use to prevent replay attacks
    await prisma.oTP.delete({ where: { id: otpRecord.id } });

    // Generate a new token with 2FA verified
    const newToken = await signToken({ ...payload, is2FAVerified: true });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
