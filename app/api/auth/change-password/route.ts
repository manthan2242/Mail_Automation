import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { password } = await request.json();
    const hashedPassword = await hashPassword(password);

    await prisma.employee.update({
      where: { id: payload.id },
      data: { 
        password: hashedPassword,
        isFirstLogin: false
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
