import { generateEmailBody } from '@/lib/ai';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject } = await request.json();
    if (!subject) {
      return NextResponse.json({ error: 'Topic or subject is required' }, { status: 400 });
    }

    // Reuse the existing AI logic
    const body = await generateEmailBody(subject, 'the Admin');
    
    return NextResponse.json({ subject, body });
  } catch (error: any) {
    console.error("Admin AI Generation Error:", error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
