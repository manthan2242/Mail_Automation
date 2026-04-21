import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const tokenHeader = request.headers.get('authorization')?.split(' ')[1];
  const tokenCookie = request.cookies.get('token')?.value;
  const token = tokenHeader || tokenCookie;

  let payload = await verifyToken(token || '');
  console.log(`Middleware Path: ${request.nextUrl.pathname}, Token: ${!!token}, Payload Valid: ${!!payload}, Role: ${payload?.role}`);

  const { pathname } = request.nextUrl;

  // Public routes
  if (
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Admin only routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
  }

  // Employee only routes (also accessible by admin)
  if (pathname.startsWith('/employee') || pathname.startsWith('/api/employee')) {
    if (payload.role !== 'employee' && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/employee/:path*',
    '/api/admin/:path*',
    '/api/employee/:path*',
  ],
};
