import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await prisma.adminMailHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
