import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { hashPassword } from '@/lib/password';

const ALLOWED_ORIGINS = [
  'http://192.168.1.9:3000',
  'http://192.168.1.9:8000',
  'http://192.168.1.9',
  'http://localhost:3000',
  'http://localhost:3004'
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const headers = new Headers();
  
  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://192.168.1.9')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // Default fallback to SPMS origin
    headers.set('Access-Control-Allow-Origin', 'http://192.168.1.9:3000');
  }
  
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret, x-api-key');
  return headers;
}

async function logRequest(details: {
  endpoint: string;
  method: string;
  clientIp: string;
  headers: any;
  authenticated: boolean;
  status: number;
  reason?: string;
  elapsedTimeMs: number;
}) {
  try {
    const logDir = path.join(process.cwd(), 'scratch');
    const logFile = path.join(logDir, 'lan_request_logs.json');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    let logs = [];
    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(content);
      } catch (e) {
        logs = [];
      }
    }
    
    const entry = {
      timestamp: new Date().toISOString(),
      ...details
    };
    
    logs.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    
    console.log(`[LAN REQUEST LOG] ${entry.timestamp} | ${entry.method} ${entry.endpoint} | IP: ${entry.clientIp} | Status: ${entry.status} | Auth: ${entry.authenticated ? 'YES' : 'NO (' + (entry.reason || '') + ')'} | Time: ${entry.elapsedTimeMs}ms`);
  } catch (error) {
    console.error('[LOGGER ERROR] Failed to write log:', error);
  }
}

export async function OPTIONS(request: NextRequest) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, { status: 200, headers });
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const reqHeaders = Object.fromEntries(request.headers.entries());

  const requestUrl = getBaseUrl(request);
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    const errorUrl = new URL('/auth/login?error=SSO+token+is+missing', requestUrl);
    const response = NextResponse.redirect(errorUrl);
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => response.headers.set(key, val));
    
    await logRequest({
      endpoint: '/sso/login',
      method: 'GET',
      clientIp,
      headers: reqHeaders,
      authenticated: false,
      status: 307,
      reason: 'SSO token is missing',
      elapsedTimeMs: Date.now() - startTime
    });
    
    return response;
  }

  // Trust either SPMS_SSO_SECRET or MAIL_SSO_SECRET from SPMS
  const ssoSecretStr = process.env.SPMS_SSO_SECRET || process.env.MAIL_SSO_SECRET;
  if (!ssoSecretStr) {
    console.error('[SSO ERROR] SPMS_SSO_SECRET or MAIL_SSO_SECRET is not configured.');
    const errorUrl = new URL('/auth/login?error=SSO+configuration+error', requestUrl);
    const response = NextResponse.redirect(errorUrl);
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => response.headers.set(key, val));
    
    await logRequest({
      endpoint: '/sso/login',
      method: 'GET',
      clientIp,
      headers: reqHeaders,
      authenticated: false,
      status: 307,
      reason: 'SSO configuration error (secrets unconfigured)',
      elapsedTimeMs: Date.now() - startTime
    });
    
    return response;
  }

  try {
    // 1. Verify token signature
    const secret = new TextEncoder().encode(ssoSecretStr);
    let payload: jose.JWTPayload;
    try {
      const verified = await jose.jwtVerify(token, secret);
      payload = verified.payload;
    } catch (err: any) {
      console.error('[SSO ERROR] Token signature verification failed:', err.message);
      const errorUrl = new URL('/auth/login?error=Invalid+SSO+token+signature', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: 'Invalid SSO token signature: ' + err.message,
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    // 2. Verify issuer is SPMS (default to SPMS if not specified in token but signature matches)
    const issuer = payload.issuer || payload.iss || 'SPMS';
    if (issuer !== 'SPMS') {
      console.error(`[SSO ERROR] Invalid issuer: ${issuer}`);
      const errorUrl = new URL('/auth/login?error=Invalid+SSO+token+issuer', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: `Invalid SSO token issuer: ${issuer}`,
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    // 3. Verify lifetime is <= 60 seconds (using issued-at 'iat' claim)
    // Fallback: if 'iat' is missing, derive it from 'exp' (assuming a 60s lifetime)
    const iat = payload.iat || (payload.exp ? (payload.exp as number) - 60 : undefined);
    if (!iat) {
      console.error('[SSO ERROR] Missing iat and exp claims in SSO token');
      const errorUrl = new URL('/auth/login?error=Invalid+SSO+token+timestamp', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: 'Missing iat and exp claims',
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - iat;

    // Check if token was issued in the future (with 10s clock drift tolerance) or if it's older than 60s
    if (ageSeconds > 60 || ageSeconds < -10) {
      console.error(`[SSO ERROR] Token timestamp expired/invalid. iat: ${iat}, now: ${nowSeconds}, age: ${ageSeconds}s`);
      const errorUrl = new URL('/auth/login?error=SSO+token+has+expired', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: `SSO token has expired. iat: ${iat}, now: ${nowSeconds}, age: ${ageSeconds}s`,
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    // 4. Extract and normalize claims (support sub for email, full_name for name)
    const rawEmail = (payload.email || payload.sub) as string;
    const email = rawEmail?.trim()?.toLowerCase();
    const rawName = (payload.name || payload.full_name) as string;
    const name = rawName?.trim() || (email ? email.split('@')[0] : 'SSO User');
    const rawRole = payload.role as string;
    const companyId = payload.company_id as string || '';

    if (!email) {
      console.error('[SSO ERROR] Missing email claim in SSO token');
      const errorUrl = new URL('/auth/login?error=SSO+token+missing+user+email', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: 'Missing email claim in token',
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    // Map roles:
    // MAIL_ADMIN -> admin
    // MAIL_EMPLOYEE, MAIL_INTERN, MAIL_CONSULTANT -> employee
    let mappedRole: 'admin' | 'employee';
    if (rawRole === 'MAIL_ADMIN' || rawRole === 'admin') {
      mappedRole = 'admin';
    } else if (
      rawRole === 'MAIL_EMPLOYEE' || 
      rawRole === 'MAIL_INTERN' || 
      rawRole === 'MAIL_CONSULTANT' ||
      rawRole === 'employee' ||
      rawRole === 'intern' ||
      rawRole === 'consultant'
    ) {
      mappedRole = 'employee';
    } else {
      console.error(`[SSO ERROR] Unknown role in SSO token: ${rawRole}`);
      const errorUrl = new URL('/auth/login?error=SSO+role+mapping+failed', requestUrl);
      const response = NextResponse.redirect(errorUrl);
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/sso/login',
        method: 'GET',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 307,
        reason: `SSO role mapping failed for raw role: ${rawRole}`,
        elapsedTimeMs: Date.now() - startTime
      });
      
      return response;
    }

    // 5. User Matching and Database Updates
    let targetUser: { id: string; email: string; name: string } | null = null;

    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    const existingEmployee = await prisma.employee.findUnique({ where: { email } });

    // Handle existing user role transition or updates
    if (existingAdmin) {
      if (mappedRole === 'admin') {
        const updated = await prisma.admin.update({
          where: { id: existingAdmin.id },
          data: {
            name,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
          },
        });
        targetUser = { id: updated.id, email: updated.email, name: updated.name };
      } else {
        console.log(`[SSO] Moving user ${email} from Admin to Employee table.`);
        await prisma.admin.delete({ where: { id: existingAdmin.id } });
        const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedPassword = await hashPassword(randomPassword);
        const createdEmployee = await prisma.employee.create({
          data: {
            email,
            username: email.split('@')[0],
            name,
            password: hashedPassword,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
            isFirstLogin: false,
          },
        });
        targetUser = { id: createdEmployee.id, email: createdEmployee.email, name: createdEmployee.name };
      }
    } else if (existingEmployee) {
      if (mappedRole === 'employee') {
        const updated = await prisma.employee.update({
          where: { id: existingEmployee.id },
          data: {
            name,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
          },
        });
        targetUser = { id: updated.id, email: updated.email, name: updated.name };
      } else {
        console.log(`[SSO] Moving user ${email} from Employee to Admin table.`);
        await prisma.employee.delete({ where: { id: existingEmployee.id } });
        const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedPassword = await hashPassword(randomPassword);
        const createdAdmin = await prisma.admin.create({
          data: {
            email,
            name,
            password: hashedPassword,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
          },
        });
        targetUser = { id: createdAdmin.id, email: createdAdmin.email, name: createdAdmin.name };
      }
    } else {
      // User does not exist, auto-create
      const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const hashedPassword = await hashPassword(randomPassword);

      if (mappedRole === 'admin') {
        const createdAdmin = await prisma.admin.create({
          data: {
            email,
            name,
            password: hashedPassword,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
          },
        });
        targetUser = { id: createdAdmin.id, email: createdAdmin.email, name: createdAdmin.name };
      } else {
        const createdEmployee = await prisma.employee.create({
          data: {
            email,
            username: email.split('@')[0],
            name,
            password: hashedPassword,
            authProvider: 'SPMS',
            externalProvider: companyId,
            lastSSOLogin: new Date(),
            isFirstLogin: false,
          },
        });
        targetUser = { id: createdEmployee.id, email: createdEmployee.email, name: createdEmployee.name };
      }
    }

    // Synchronize/upsert in global User table
    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        authProvider: 'SPMS',
        externalProvider: companyId,
        lastSSOLogin: new Date(),
      },
      create: {
        email,
        name,
        authProvider: 'SPMS',
        externalProvider: companyId,
        lastSSOLogin: new Date(),
      },
    });

    // 6. Generate Session Token and set in HTTP-Only cookie
    const sessionToken = await signToken({
      id: targetUser.id,
      email: targetUser.email,
      role: mappedRole,
      is2FAVerified: true,
    });

    console.log(`[SSO SUCCESS] Authenticated user ${email} as ${mappedRole}. Redirecting to /dashboard.`);

    const redirectResponse = NextResponse.redirect(new URL('/dashboard', requestUrl));
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => redirectResponse.headers.set(key, val));
    
    redirectResponse.cookies.set('token', sessionToken, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    await logRequest({
      endpoint: '/sso/login',
      method: 'GET',
      clientIp,
      headers: reqHeaders,
      authenticated: true,
      status: 307,
      elapsedTimeMs: Date.now() - startTime
    });

    return redirectResponse;
  } catch (error: any) {
    console.error('[SSO ERROR] Unexpected error in SSO login flow:', error);
    const errorUrl = new URL(`/auth/login?error=${encodeURIComponent(error.message || 'Internal server error')}`, requestUrl);
    const response = NextResponse.redirect(errorUrl);
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => response.headers.set(key, val));
    
    await logRequest({
      endpoint: '/sso/login',
      method: 'GET',
      clientIp,
      headers: reqHeaders,
      authenticated: false,
      status: 307,
      reason: 'Unexpected exception: ' + error.message,
      elapsedTimeMs: Date.now() - startTime
    });
    
    return response;
  }
}
