import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'employee' && payload.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        primaryMail: true,
        secondaryMail: true,
        optionalMail: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Fetch employee clients error:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
