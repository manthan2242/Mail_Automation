import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const keys = await prisma.aPIKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(keys);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const key = `sk_${uuidv4().replace(/-/g, '')}`;
    const apiKey = await prisma.aPIKey.create({
      data: { name, key },
    });
    return NextResponse.json(apiKey);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await prisma.aPIKey.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
