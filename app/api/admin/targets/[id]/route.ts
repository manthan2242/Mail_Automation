import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] DELETE /api/admin/targets/${id} - Removing target`);
    await prisma.target.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API TARGETS DELETE ERROR id=${params}]:`, error);
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}
