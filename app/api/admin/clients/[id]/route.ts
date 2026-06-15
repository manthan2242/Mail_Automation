import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    let { name, primaryMail, secondaryMail, optionalMail, optionalMails } = body;

    name = name?.trim() || '';
    primaryMail = primaryMail?.trim()?.toLowerCase() || '';

    let emails: string[] = [];
    if (Array.isArray(optionalMails)) {
      emails = optionalMails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean);
    } else {
      if (secondaryMail) emails.push(secondaryMail.trim().toLowerCase());
      if (optionalMail) {
        optionalMail.split(',').forEach((e: string) => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) emails.push(trimmed);
        });
      }
    }

    // Ensure uniqueness of optional emails
    const uniqueEmails = Array.from(new Set(emails));
    const secMail = uniqueEmails[0] || null;
    const optMail = uniqueEmails.length > 1 ? uniqueEmails.slice(1).join(', ') : null;

    if (!name || !primaryMail) {
      return NextResponse.json({ error: 'Name and Primary Email are required' }, { status: 400 });
    }

    if (uniqueEmails.includes(primaryMail)) {
      return NextResponse.json({ error: 'Optional email addresses must be different from the Primary email address' }, { status: 400 });
    }

    console.log(`[API] PUT /api/admin/clients/${id} - Updating client`);
    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        primaryMail,
        secondaryMail: secMail,
        optionalMail: optMail
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
