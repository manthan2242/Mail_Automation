import { generateAdminResponse } from '@/lib/ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { body, action } = await request.json();
    const response = await generateAdminResponse(body, action);
    return NextResponse.json({ response });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}
