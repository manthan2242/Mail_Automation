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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    const results = await prisma.adminMailHistory.findMany({
      where: {
        OR: [
          { to: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
