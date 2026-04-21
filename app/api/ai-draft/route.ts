import { generateEmailBody } from '@/lib/ai';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { topic } = await request.json();
    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const body = await generateEmailBody(topic);
    
    if (!body) {
      throw new Error('AI returned empty response');
    }

    return NextResponse.json({ body });
  } catch (error: any) {
    console.error("AI Draft Backend Error:", error);
    return NextResponse.json({ 
      error: 'AI Draft failed. Please try again.',
      details: error.message 
    }, { status: 500 });
  }
}
