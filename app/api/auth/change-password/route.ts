import { prisma } from '@/lib/db';
import { hashPassword, validatePasswordComplexity } from '@/lib/password';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { password } = await request.json();
    const complexityError = validatePasswordComplexity(password);
    if (complexityError) {
      return NextResponse.json({ error: complexityError }, { status: 400 });
    }

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
