import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    let { name, primaryMail, secondaryMail, optionalMail } = body;

    name = name?.trim() || '';
    primaryMail = primaryMail?.trim()?.toLowerCase() || '';
    secondaryMail = secondaryMail?.trim()?.toLowerCase() || null;
    optionalMail = optionalMail?.trim()?.toLowerCase() || null;

    if (!name || !primaryMail || !secondaryMail) {
      return NextResponse.json({ error: 'Name, Primary Email, and Secondary Email are required' }, { status: 400 });
    }

    if (primaryMail === secondaryMail) {
      return NextResponse.json({ error: 'Primary and Secondary email addresses must be different' }, { status: 400 });
    }

    if (optionalMail && (optionalMail === primaryMail || optionalMail === secondaryMail)) {
      return NextResponse.json({ error: 'Optional Email must be different from Primary and Secondary emails' }, { status: 400 });
    }

    console.log(`[API] PUT /api/admin/clients/${id} - Updating client`);
    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        primaryMail,
        secondaryMail: secondaryMail || null,
        optionalMail: optionalMail || null
      }
    });

    return NextResponse.json(client);
  } catch (error: any) {
    console.error(`[API CLIENTS PUT ERROR id=${params}]:`, error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A client with this primary email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] DELETE /api/admin/clients/${id} - Removing client`);
    await prisma.client.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API CLIENTS DELETE ERROR id=${params}]:`, error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
