import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId');
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      const employeesWithAttendance = await prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          attendanceLogs: {
            where: {
              clockIn: {
                gte: start,
                lte: end,
              },
            },
            orderBy: {
              clockIn: 'asc',
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      return NextResponse.json(employeesWithAttendance);
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId or date range is required' }, { status: 400 });
    }

    const attendanceLogs = await prisma.attendanceLog.findMany({
      where: { employeeId },
      orderBy: { clockIn: 'desc' },
    });

    return NextResponse.json(attendanceLogs);
  } catch (error) {
    console.error('Fetch employee attendance logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 });
  }
}
