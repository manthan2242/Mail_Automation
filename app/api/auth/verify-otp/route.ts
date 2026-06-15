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

    // Fetch the user to check lockout state
    let user: any = null;
    if (payload.role === 'admin') {
      user = await prisma.admin.findUnique({ where: { email: payload.email } });
    } else {
      user = await prisma.employee.findUnique({ where: { email: payload.email } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return NextResponse.json({ 
        error: `Account is locked due to multiple failed attempts. Please try again in ${waitMinutes} minutes.` 
      }, { status: 403 });
    }

    // Enforce OTP checking strictly
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: payload.email,
        code: sanitizedCode,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      console.log('OTP not found or expired for email:', payload.email);
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= 5;
      const lockedUntil = shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null;

      if (payload.role === 'admin') {
        await prisma.admin.update({
          where: { id: user.id },
          data: { failedAttempts, lockedUntil }
        });
      } else {
        await prisma.employee.update({
          where: { id: user.id },
          data: { failedAttempts, lockedUntil }
        });
      }

      if (shouldLock) {
        return NextResponse.json({ 
          error: 'Too many failed OTP attempts. Your account has been locked for 15 minutes.' 
        }, { status: 403 });
      }

      return NextResponse.json({ error: 'Invalid or expired OTP. Please try again or request a new one.' }, { status: 400 });
    }

    console.log('OTP verified successfully!');
    // Delete OTP after successful use to prevent replay attacks
    await prisma.oTP.delete({ where: { id: otpRecord.id } });

    // Reset lockout fields
    if (user.failedAttempts > 0 || user.lockedUntil) {
      if (payload.role === 'admin') {
        await prisma.admin.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null }
        });
      } else {
        await prisma.employee.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null }
        });
      }
    }

    // Generate a new token with 2FA verified
    const newToken = await signToken({ ...payload, is2FAVerified: true });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
