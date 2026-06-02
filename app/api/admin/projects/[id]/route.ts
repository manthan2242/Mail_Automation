import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] DELETE /api/admin/projects/${id} - Removing project`);
    await prisma.project.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API PROJECTS DELETE ERROR id=${params}]:`, error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
