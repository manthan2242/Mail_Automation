import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { EMAIL_SUBJECTS, AUTH_CONFIG, APP_CONFIG } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const recentOtp = await prisma.oTP.findFirst({
      where: { 
        email: payload.email,
        createdAt: { gt: new Date(Date.now() - AUTH_CONFIG.OTP_COOLDOWN_SECONDS * 1000) } // configurable cooldown
      }
    });

    if (recentOtp) {
      console.log(`[RESEND] Cooldown active for ${payload.email}`);
      return NextResponse.json({ 
        error: `Please wait ${AUTH_CONFIG.OTP_COOLDOWN_SECONDS} seconds before requesting a new code.`,
        success: false 
      }, { status: 429 });
    }

    // Clean up old codes for this user to ensure only the latest works
    await prisma.oTP.deleteMany({ where: { email: payload.email } });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);
    const now = new Date();

    try {
      // Send BEFORE saving to database
      await sendEmail(
        payload.email,
        EMAIL_SUBJECTS.OTP(APP_CONFIG.NAME),
        `Your security verification OTP code is: ${code}. This code will expire in ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
        undefined,
        undefined,
        true // noBcc: true
      );
      
      // 3. Save to DB AFTER successful send
      await prisma.oTP.create({
        data: {
          email: payload.email,
          code,
          expiresAt: new Date(now.getTime() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000), 
        }
      });
      console.log("[RESEND SUCCESS] New OTP Transmitted to:", payload.email);
      return NextResponse.json({ success: true, message: 'Official verification code sent safely.' });
    } catch (e: any) {
      console.error('[RESEND ERROR] SMTP failure:', e.message);
      return NextResponse.json({ error: 'Failed to deliver resend request: ' + e.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Failed to trigger OTP generation' }, { status: 500 });
  }
}
