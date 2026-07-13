import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tokenHeader = request.headers.get('authorization')?.split(' ')[1];
    const tokenCookie = request.cookies.get('token')?.value;
    const token = tokenHeader || tokenCookie;

    if (!token) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    let user: any = null;
    if (payload.role === 'admin') {
      user = await prisma.admin.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true }
      });
    } else if (payload.role === 'employee') {
      user = await prisma.employee.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, isFirstLogin: true }
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: payload.role,
        isFirstLogin: payload.role === 'employee' ? user.isFirstLogin : false,
        is2FAVerified: payload.is2FAVerified ?? true
      },
      token
    });
  } catch (error) {
    console.error('[SESSION API ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
