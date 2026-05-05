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

    try {
      await sendEmail(
        email,
        'Welcome to Mail Automation - Your Credentials',
        `Hello ${name},\n\nYour account has been created successfully.\n\n` +
        `Login Credentials:\n` +
        `Username: ${username}\n` +
        `Password: ${randomPassword}\n\n` +
        `Please login and change your password immediately: ${process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL}/auth/login`,
        undefined,
        smtpConfig?.id
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // We don't fail the whole request if only the email fails, but we've logged it.
    }

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
    await prisma.employee.delete({ where: { id } });
    console.log('[API] Success: Employee deleted from DB');
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
