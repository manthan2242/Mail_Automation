import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  let requestUrl = request.url;
  if (requestUrl.includes('//0.0.0.0')) {
    requestUrl = requestUrl.replace('//0.0.0.0', '//192.168.1.6');
  }

  const token = request.cookies.get('token')?.value;

  if (!token) {
    console.log('[DASHBOARD ROUTER] No session token found, redirecting to /auth/login');
    return NextResponse.redirect(new URL('/auth/login', requestUrl));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    console.log('[DASHBOARD ROUTER] Session token is invalid or expired, redirecting to /auth/login');
    return NextResponse.redirect(new URL('/auth/login', requestUrl));
  }

  console.log(`[DASHBOARD ROUTER] Routing authenticated user ${payload.email} (${payload.role}) to workspace dashboard`);

  if (payload.role === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', requestUrl));
  } else if (payload.role === 'employee') {
    return NextResponse.redirect(new URL('/employee/dashboard', requestUrl));
  }

  console.warn(`[DASHBOARD ROUTER] User has unmapped role: ${payload.role}, redirecting to login`);
  return NextResponse.redirect(new URL('/auth/login', requestUrl));
}
