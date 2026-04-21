import { generateEmailBody } from '@/lib/ai';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { subject, sourceEmail } = await request.json();
    if (!sourceEmail || sourceEmail.trim() === "") {
      return NextResponse.json({ error: 'Source email is required' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const body = await generateEmailBody(subject, sourceEmail);
    
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
