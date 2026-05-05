import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const configs = await prisma.emailConfig.findMany({
      select: {
        id: true,
        email: true
      }
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error fetching assigned emails:', error);
    return NextResponse.json({ error: 'Failed to fetch assigned emails' }, { status: 500 });
  }
}
