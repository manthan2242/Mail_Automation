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

    const { employeeId, projectId } = await request.json();
    
    if (!employeeId || !projectId) {
      return NextResponse.json({ error: 'Missing employeeId or projectId' }, { status: 400 });
    }

    // Check if project is already assigned to this employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        assignedProjects: {
          where: { id: projectId }
        }
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const isAssigned = employee.assignedProjects.length > 0;

    if (isAssigned) {
      // Disconnect project assignment
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          assignedProjects: {
            disconnect: { id: projectId }
          }
        }
      });
      return NextResponse.json({ success: true, message: 'Project assignment removed' });
    } else {
      // Connect project assignment
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          assignedProjects: {
            connect: { id: projectId }
          }
        }
      });
      return NextResponse.json({ success: true, message: 'Project assigned successfully' });
    }
  } catch (error) {
    console.error('Assign project error:', error);
    return NextResponse.json({ error: 'Failed to assign project' }, { status: 500 });
  }
}
