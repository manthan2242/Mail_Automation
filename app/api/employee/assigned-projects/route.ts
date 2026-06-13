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

    let projects: any[] = [];
    if (payload.role === 'employee') {
      const employee = await prisma.employee.findUnique({
        where: { id: payload.id },
        include: {
          assignedProjects: {
            include: {
              client: {
                select: { 
                  id: true,
                  name: true,
                  primaryMail: true,
                  secondaryMail: true,
                  optionalMail: true
                }
              }
            }
          }
        }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      projects = employee.assignedProjects || [];
    } else {
      projects = await prisma.project.findMany({
        include: {
          client: {
            select: { 
              id: true,
              name: true,
              primaryMail: true,
              secondaryMail: true,
              optionalMail: true
            }
          }
        }
      });
    }

    const projectIds = projects.map(p => p.id);

    const targets = await prisma.target.findMany({
      where: {
        projectId: { in: projectIds }
      },
      include: {
        client: {
          select: { name: true }
        },
        project: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      projects,
      targets
    });
  } catch (error) {
    console.error('Fetch employee assigned projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch assigned projects' }, { status: 500 });
  }
}
