import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function GET() {
  try {
    const adminPassword = await hashPassword('Admin@123');
    
    const admin = await prisma.admin.upsert({
      where: { email: 'admin@salesforcepro.com' },
      update: {},
      create: {
        email: 'admin@salesforcepro.com',
        password: adminPassword,
        name: 'System Admin',
      },
    });

    return NextResponse.json({ message: 'Seeded admin', email: admin.email });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
  }
}
