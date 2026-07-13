import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://192.168.1.9:3000',
  'http://192.168.1.9:8000',
  'http://192.168.1.9',
  'http://localhost:3000',
  'http://localhost:3004',
  'https://mail-automation.sambhavaintech.com'
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const headers = new Headers();
  
  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://192.168.1.9')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', 'http://192.168.1.9:3000');
  }
  
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret, x-api-key');
  return headers;
}

function getBaseUrl(request: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (process.env.NODE_ENV === 'production' && envUrl) {
    return envUrl;
  }
  
  let requestUrl = request.url;
  if (requestUrl.includes('//0.0.0.0')) {
    requestUrl = requestUrl.replace('//0.0.0.0', '//192.168.1.6');
  }
  return requestUrl;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, { status: 200, headers });
}

export async function GET(request: NextRequest) {
  const baseRedirectUrl = getBaseUrl(request);
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  // Redirect to the correct top-level SSO login route
  const targetUrl = new URL(`/sso/login${token ? `?token=${token}` : ''}`, baseRedirectUrl);
  
  console.log(`[SSO REDIRECT GATEWAY] Redirecting from /auth/login/sso/login to /sso/login`);
  
  const response = NextResponse.redirect(targetUrl);
  const cors = getCorsHeaders(request);
  cors.forEach((val, key) => response.headers.set(key, val));
  
  return response;
}
