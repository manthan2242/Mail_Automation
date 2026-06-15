import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { comparePassword } from '@/lib/password';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let { email, password } = await request.json();
    email = email?.trim()?.toLowerCase();

    let userRole: 'admin' | 'employee' | null = null;
    let user: any = null;

    // First find the user record without verifying password yet
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      userRole = 'admin';
      user = admin;
    } else {
      const employee = await prisma.employee.findUnique({ where: { email } });
      if (employee) {
        userRole = 'employee';
        user = employee;
      }
    }

    if (!user || !userRole) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 1. Check if user is locked out
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return NextResponse.json({ 
        error: `Account is locked due to multiple failed attempts. Please try again in ${waitMinutes} minutes.` 
      }, { status: 403 });
    }

    // 2. Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= 5;
      const lockedUntil = shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null;

      if (userRole === 'admin') {
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
          error: 'Too many failed login attempts. Your account has been locked for 15 minutes.' 
        }, { status: 403 });
      }

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Password is valid - reset failed attempts and lockout
    if (user.failedAttempts > 0 || user.lockedUntil) {
      if (userRole === 'admin') {
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
      user.failedAttempts = 0;
      user.lockedUntil = null;
    }

    // Set Token
    let is2FAVerified = true;
    let requires2FA = false;

    // Determine if OTP/2FA is required
    let shouldEnforce2FA = false;
    if (userRole === 'admin') {
      shouldEnforce2FA = (user as any).twoFactorEnabled;
    } else if (userRole === 'employee') {
      // OTP is only needed for the 1st time login of an employee
      shouldEnforce2FA = (user as any).isFirstLogin;
    }

    // 2FA Enforcement Block (for both Admin and Employee)
    if (user && shouldEnforce2FA) {
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
            
            // 2. Send with noBcc: true to prevent duplicates in SMTP box
            await sendEmail(
              user.email,
              'Security Verification - Your OTP Code',
              `Your security verification OTP code is: ${code}. This code will expire in 5 minutes.`,
              { noBcc: true }
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

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
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
