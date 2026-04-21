import { generateEmailBody } from '@/lib/ai';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      // For this specific task, if token is missing but it's an internal call, 
      // we might want to allow it if we're in a specific dev context, 
      // but let's stick to security.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const { subject } = await request.json();
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const body = await generateEmailBody(subject);
    
    if (!body) {
      throw new Error('AI returned empty response');
    }

    return NextResponse.json({ body });
  } catch (error: any) {
    console.error("AI Email Generation Error:", error);
    return NextResponse.json({ 
      error: 'AI Generation failed. Please try again.',
      details: error.message 
    }, { status: 500 });
  }
}
