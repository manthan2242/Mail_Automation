import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { employeeId, emailAccountId } = await request.json();
    
    if (!employeeId || !emailAccountId) {
      return NextResponse.json({ error: 'Missing employeeId or emailAccountId' }, { status: 400 });
    }

    const existing = await prisma.emailAssignment.findUnique({
      where: {
        employeeId_emailAccountId: {
          employeeId,
          emailAccountId
        }
      }
    });

    if (existing) {
      await prisma.emailAssignment.delete({
        where: {
          employeeId_emailAccountId: {
            employeeId,
            emailAccountId
          }
        }
      });
      return NextResponse.json({ success: true, message: 'Assignment removed' });
    }

    const assignment = await prisma.emailAssignment.create({
      data: {
        employeeId,
        emailAccountId
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Assign email error:', error);
    return NextResponse.json({ error: 'Failed to assign email' }, { status: 500 });
  }
}
