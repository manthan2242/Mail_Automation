import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const employees = await prisma.employee.findMany({
      select: { email: true, name: true }
    });
    const admins = await prisma.admin.findMany({
      select: { email: true, name: true }
    });
    
    // Also fetch previous unique "TO" addresses they've used
    const pastEmails = await prisma.email.findMany({
      where: { senderId: payload.id, to: { not: null } },
      select: { to: true },
      distinct: ['to'],
    });

    const suggestions = [
      ...employees,
      ...admins,
      ...pastEmails.map(e => ({ email: e.to as string, name: e.to?.split('@')[0] || '' }))
    ];

    // Remove duplicates
    const unique = Array.from(new Map(suggestions.map(item => [item.email, item])).values());

    return NextResponse.json(unique);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}
