import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { comparePassword } from '@/lib/password';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let { email, password } = await request.json();
    email = email?.trim()?.toLowerCase();

    let userRole: 'admin' | 'employee' | null = null;
    let user = null;

    // Check Admin first
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin && (await comparePassword(password, admin.password))) {
      userRole = 'admin';
      user = admin;
    } else {
      // Check Employee next
      const employee = await prisma.employee.findUnique({ where: { email } });
      if (employee && (await comparePassword(password, employee.password))) {
        userRole = 'employee';
        user = employee;
      }
    }

    if (!user || !userRole) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Set Token
    let is2FAVerified = true;
    let requires2FA = false;

    // 2FA Enforcement Block (for both Admin and Employee)
    if (user && (user as any).twoFactorEnabled) {
      is2FAVerified = false;
      requires2FA = true;

      const method = (user as any).twoFactorMethod || 'email';
      
      if (method === 'email') {
        // 1. Check for the LATEST OTP to implement 60s rate limiting
        const latestOtp = await prisma.oTP.findFirst({
          where: { email: user.email },
          orderBy: { createdAt: 'desc' }
        });

        const now = new Date();
        const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

        if (latestOtp && latestOtp.createdAt > sixtySecondsAgo) {
          console.log(`[AUTH RATE LIMIT] Throttling OTP request for: ${user.email}`);
          // We let them proceed but don't send a new one yet if one was JUST sent
        } else {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const { sendEmail } = require('@/lib/email');
          
          try {
            console.log(`[AUTH] Dispatching OTP ONLY to login email: ${user.email}`);
            
            // 2. Send with noBcc: true (6th argument) to prevent duplicates in SMTP box
            await sendEmail(
              user.email,
              'Security Verification - Your OTP Code',
              `Your security verification OTP code is: ${code}. This code will expire in 5 minutes.`,
              undefined,
              undefined,
              true // noBcc: true
            );
            
            // 3. Save to DB AFTER successful send
            await prisma.oTP.create({
              data: {
                email: user.email,
                code,
                expiresAt: new Date(now.getTime() + 5 * 60 * 1000), 
              }
            });
            
            console.log(`[AUTH SUCCESS] OTP sent specifically to: ${user.email}`);
          } catch (err: any) {
            console.error("[AUTH ERROR] OTP Delivery Failed:", err.message);
            return NextResponse.json({ 
              error: "Security code delivery failed. Please check your internet connection or contact support."
            }, { status: 500 });
          }
        }
      }
    }

    const token = await signToken({ 
      id: user.id, 
      email: user.email, 
      role: userRole, 
      is2FAVerified 
    });

    const response = NextResponse.json({
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: userRole, 
        isFirstLogin: userRole === 'employee' ? (user as any).isFirstLogin : false,
        is2FAVerified 
      },
      token,
      requires2FA,
      method: (user as any).twoFactorMethod || 'email'
    });

    const isHttps = 
      request.headers.get('x-forwarded-proto') === 'https' || 
      request.url.startsWith('https:');

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
