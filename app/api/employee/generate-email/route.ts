import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateWithProvider, PROVIDER_KEYS } from '@/lib/ai-providers';
import { generateEmailBody } from '@/lib/ai';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse body once
    const { subject, sourceEmail, provider, rawKey } = await request.json();

    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (!sourceEmail) return NextResponse.json({ error: 'Source email is required' }, { status: 400 });

    let body: string;

    // If a provider is chosen and employee sent their raw key for this request
    if (provider && rawKey && payload.role === 'employee') {
      if (!PROVIDER_KEYS.includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
      }

      // Validate the submitted key matches the employee's stored hash
      const keyRecord = await prisma.userAiKey.findUnique({
        where: { employeeId_provider: { employeeId: payload.id, provider } }
      });

      if (!keyRecord || !keyRecord.isActive) {
        return NextResponse.json(
          { error: `No active API key saved for "${provider}". Add one in Settings → AI Keys.` },
          { status: 400 }
        );
      }

      const clientHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      if (clientHash !== keyRecord.hashedKey) {
        return NextResponse.json({ error: 'API key does not match your saved key.' }, { status: 403 });
      }

      body = await generateWithProvider(provider, rawKey, subject, sourceEmail);
    } else {
      // Fallback: global Gemini key from env
      body = await generateEmailBody(subject, sourceEmail) as string;
    }

    if (!body) throw new Error('AI returned empty response');
    return NextResponse.json({ body });

  } catch (error: any) {
    console.error('AI Email Generation Error:', error);
    return NextResponse.json({ error: 'AI Generation failed. Please try again.' }, { status: 500 });
  }
}
