import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      totalEmployees,
      totalEmails,
      pendingEmails,
      approvedEmails,
      rejectedEmails,
      smtpConfigs
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.email.count(),
      prisma.email.count({ where: { status: 'PENDING' } }),
      prisma.email.count({ where: { status: 'APPROVED' } }),
      prisma.email.count({ where: { status: 'REJECTED' } }),
      prisma.emailConfig.count(),
    ]);

    return NextResponse.json({
      totalEmployees,
      totalEmails,
      pendingEmails,
      approvedEmails,
      rejectedEmails,
      smtpConfigs,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
