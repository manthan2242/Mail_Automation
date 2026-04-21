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

    const assignments = await prisma.emailAssignment.findMany({
      where: { employeeId: payload.id },
      include: {
        emailAccount: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const assignedEmails = assignments.map(a => ({
      id: a.emailAccount.id,
      email: a.emailAccount.email
    }));

    return NextResponse.json(assignedEmails);
  } catch (error) {
    console.error('Error fetching assigned emails:', error);
    return NextResponse.json({ error: 'Failed to fetch assigned emails' }, { status: 500 });
  }
}
