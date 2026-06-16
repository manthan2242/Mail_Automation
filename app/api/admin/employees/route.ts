import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { DEFAULT_APP_URL } from '@/lib/constants';

export async function GET() {
  try {
    console.log('[API] GET /api/admin/employees - Fetching all employees');
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        isFirstLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[API] Success: Found ${employees.length} employees`);
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let { email, username, name } = await request.json();
    
    // Trim accidental whitespace from inputs
    email = email?.trim()?.toLowerCase() || '';
    username = username?.trim() || '';
    name = name?.trim() || '';

    // Generate a random password: 10 chars, includes special symbols
    const generateRandomPassword = (length: number = 10) => {
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let password = "";
      for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return password;
    };

    const randomPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(randomPassword);

    console.log('[API] POST /api/admin/employees - Creating employee:', email);
    const employee = await prisma.employee.create({
      data: {
        email,
        username,
        name,
        password: hashedPassword,
        twoFactorEnabled: true, // Enable 2FA by default as requested
      },
    });
    console.log('[API] Success: Employee created in DB with ID:', employee.id);

    // Fetch the first available SMTP config to send the welcome email
    const smtpConfig = await prisma.emailConfig.findFirst();

    // Send email asynchronously in the background so the HTTP response returns immediately
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Sales Force Pro';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
    const loginUrl = `${appUrl}/auth/login`;

    const welcomeBodyHtml = `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 700;">${appName}</h2>
    <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Account Setup Invitation</p>
  </div>
  <div style="background-color: #ffffff; padding: 35px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
    <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 600;">Hello ${name},</h3>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      An account has been set up for you. To complete your activation, use the registered email and code shown below:
    </p>
    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e2e8f0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; padding-bottom: 8px; width: 40%;">Registered Email:</td>
          <td style="color: #0f172a; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${email}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; padding-top: 8px;">Activation Code:</td>
          <td style="color: #0f172a; font-size: 14px; font-family: monospace; font-weight: 600; padding-top: 8px; letter-spacing: 0.5px;">${randomPassword}</td>
        </tr>
      </table>
    </div>
    <p style="color: #475569; font-size: 13px; line-height: 1.5; margin-bottom: 25px;">
      You will establish your own password to verify your account when logging in for the first time.
    </p>
    <div style="text-align: center; margin-top: 25px; margin-bottom: 10px;">
      <a href="${loginUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
        Activate Account
      </a>
    </div>
  </div>
  <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 11px;">
    <p style="margin: 0;">This is an automated administrative notification. Please do not reply directly to this email.</p>
    <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</div>
`.replace(/\n/g, ' ');

    sendEmail(
      email,
      `Account Created - ${appName}`,
      welcomeBodyHtml,
      undefined,
      smtpConfig?.id
    ).catch((emailError: any) => {
      console.error('Failed to send welcome email in background:', emailError);
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email or Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    console.log('[API] DELETE /api/admin/employees - ID:', id);
    // Use deleteMany to avoid throwing P2025 error if the record was already deleted
    await prisma.employee.deleteMany({ where: { id } });
    console.log('[API] Success: Employee deletion processed');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const employee = await prisma.employee.update({
      where: { id },
      data,
    });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}
