import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { hashApiKey, maskApiKey } from '@/lib/api-key';
import { validateKeyFormat, verifyKeyWithProvider } from '@/lib/validate-ai-key';

const PROVIDERS = ['openai', 'gemini', 'groq', 'claude', 'openrouter'] as const;

async function validateEmployee(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  if (!token) return { error: 'Unauthorized', status: 401 };
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'employee') return { error: 'Forbidden', status: 403 };
  return { payload };
}

// GET - list all provider keys for employee (masked)
export async function GET(request: Request) {
  const auth = await validateEmployee(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const keys = await prisma.userAiKey.findMany({
    where: { employeeId: auth.payload.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, provider: true, maskedKey: true, isActive: true, createdAt: true }
  });
  return NextResponse.json(keys);
}

// POST - validate and save a new provider key
export async function POST(request: Request) {
  const auth = await validateEmployee(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { provider, apiKey } = await request.json();
  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'Provider and API key are required.' }, { status: 400 });
  }

  if (!PROVIDERS.includes(provider as any)) {
    return NextResponse.json({ error: 'Invalid provider.' }, { status: 400 });
  }

  const validProvider = provider as typeof PROVIDERS[number];

  // ── Step 1: Format validation ──
  const formatError = validateKeyFormat(validProvider, apiKey.trim());
  if (formatError) {
    return NextResponse.json({ error: formatError }, { status: 400 });
  }

  // ── Step 2: Real API verification (CRITICAL) ──
  const verification = await verifyKeyWithProvider(validProvider, apiKey.trim());
  if (!verification.valid) {
    return NextResponse.json(
      { error: `Key verification failed: ${verification.error || 'Invalid or unauthorized API key.'}` },
      { status: 403 }
    );
  }

  // ── Step 3: Hash and save ──
  const hashedKey = hashApiKey(apiKey.trim());
  const maskedKey = maskApiKey(apiKey.trim());

  const record = await prisma.userAiKey.upsert({
    where: { employeeId_provider: { employeeId: auth.payload.id, provider: validProvider } },
    update: { hashedKey, maskedKey, isActive: true, updatedAt: new Date() },
    create: { employeeId: auth.payload.id, provider: validProvider, hashedKey, maskedKey },
  });

  return NextResponse.json({
    id: record.id,
    provider: record.provider,
    maskedKey: record.maskedKey,
    isActive: record.isActive,
    verified: true
  });
}

// PATCH - toggle active status
export async function PATCH(request: Request) {
  const auth = await validateEmployee(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, isActive } = await request.json();
  const updated = await prisma.userAiKey.update({
    where: { id, employeeId: auth.payload.id },
    data: { isActive },
  });
  return NextResponse.json(updated);
}

// DELETE - remove a provider key
export async function DELETE(request: Request) {
  const auth = await validateEmployee(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  await prisma.userAiKey.delete({ where: { id, employeeId: auth.payload.id } });
  return NextResponse.json({ success: true });
}
