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

    const activeSession = await prisma.attendanceLog.findFirst({
      where: {
        employeeId: payload.id,
        clockOut: null,
      },
    });

    const recentLogs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: payload.id,
      },
      orderBy: {
        clockIn: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({
      activeSession,
      recentLogs,
    });
  } catch (error) {
    console.error('Fetch employee attendance logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action } = await request.json();
    if (action !== 'in' && action !== 'out') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const activeSession = await prisma.attendanceLog.findFirst({
      where: {
        employeeId: payload.id,
        clockOut: null,
      },
    });

    if (action === 'in') {
      if (activeSession) {
        return NextResponse.json({ error: 'Already clocked in', activeSession }, { status: 400 });
      }

      const newLog = await prisma.attendanceLog.create({
        data: {
          employeeId: payload.id,
          clockIn: new Date(),
        },
      });

      return NextResponse.json({ message: 'Clocked in successfully', session: newLog });
    } else {
      if (!activeSession) {
        return NextResponse.json({ error: 'Not clocked in' }, { status: 400 });
      }

      const updatedLog = await prisma.attendanceLog.update({
        where: { id: activeSession.id },
        data: { clockOut: new Date() },
      });

      return NextResponse.json({ message: 'Clocked out successfully', session: updatedLog });
    }
  } catch (error) {
    console.error('Toggle employee attendance error:', error);
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}
