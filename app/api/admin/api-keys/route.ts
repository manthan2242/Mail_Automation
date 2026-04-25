import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { generateApiKey, hashApiKey, maskApiKey } from '@/lib/api-key';

async function validateAdmin(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  if (!token) return { error: 'Unauthorized', status: 401 };
  
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { payload };
}

export async function GET(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const keys = await prisma.apiKey.findMany({
      where: { adminId: auth.payload.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        maskedKey: true,
        isActive: true,
        createdAt: true,
      }
    });
    return NextResponse.json(keys);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const rawKey = generateApiKey();
    const hashedKey = hashApiKey(rawKey);
    const maskedKey = maskApiKey(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: { 
        name, 
        hashedKey, 
        maskedKey, 
        adminId: auth.payload.id 
      },
    });

    // Return the raw key ONLY once
    return NextResponse.json({
      ...apiKey,
      rawKey // SECURE: Exposed only once upon creation
    });
  } catch (error) {
    console.error('[API_KEY_GEN_ERROR]', error);
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.apiKey.delete({ 
      where: { 
        id,
        adminId: auth.payload.id // Ensure admin owns the key
      } 
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updated = await prisma.apiKey.update({
      where: { 
        id,
        adminId: auth.payload.id
      },
      data: { isActive }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}
