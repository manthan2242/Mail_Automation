import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/db';
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const reqHeaders = Object.fromEntries(request.headers.entries());

  try {
    // 1. Authenticate using INTERNAL_API_SECRET or MAIL_INTERNAL_SECRET from SPMS
    const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.MAIL_INTERNAL_SECRET;
    if (!expectedSecret) {
      console.error('[SYNC ERROR] INTERNAL_API_SECRET or MAIL_INTERNAL_SECRET is not configured.');
      
      const response = NextResponse.json({ error: 'Sync API configuration error' }, { status: 500 });
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/api/internal/users/sync',
        method: 'POST',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 500,
        reason: 'Sync API secrets unconfigured',
        elapsedTimeMs: Date.now() - startTime
      });
      return response;
    }

    const authHeader = request.headers.get('authorization');
    const internalSecretHeader = request.headers.get('x-internal-secret');
    const apiKeyHeader = request.headers.get('x-api-key');

    let providedKey = '';
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      providedKey = authHeader.substring(7).trim();
    } else if (internalSecretHeader) {
      providedKey = internalSecretHeader.trim();
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader.trim();
    }

    if (!providedKey || providedKey !== expectedSecret) {
      console.warn('[SYNC WARN] Unauthorized sync request attempted.');
      
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/api/internal/users/sync',
        method: 'POST',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 401,
        reason: 'Unauthorized: missing or invalid credentials',
        elapsedTimeMs: Date.now() - startTime
      });
      return response;
    }

    // 2. Parse request body
    const body = await request.json();
    let { email, name, role, status } = body;

    email = email?.trim()?.toLowerCase();
    name = name?.trim();
    role = role?.trim();
    status = status?.trim()?.toLowerCase();

    if (!email || !role) {
      const response = NextResponse.json({ error: 'Missing email or role parameter' }, { status: 400 });
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/api/internal/users/sync',
        method: 'POST',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 400,
        reason: 'Missing email or role in request body',
        elapsedTimeMs: Date.now() - startTime
      });
      return response;
    }

    // Map incoming role:
    // MAIL_ADMIN -> admin
    // MAIL_EMPLOYEE, MAIL_INTERN, MAIL_CONSULTANT -> employee
    let mappedRole: 'admin' | 'employee';
    if (role === 'MAIL_ADMIN' || role === 'admin') {
      mappedRole = 'admin';
    } else if (
      role === 'MAIL_EMPLOYEE' || 
      role === 'MAIL_INTERN' || 
      role === 'MAIL_CONSULTANT' ||
      role === 'employee' ||
      role === 'intern' ||
      role === 'consultant'
    ) {
      mappedRole = 'employee';
    } else {
      const response = NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      const cors = getCorsHeaders(request);
      cors.forEach((val, key) => response.headers.set(key, val));
      
      await logRequest({
        endpoint: '/api/internal/users/sync',
        method: 'POST',
        clientIp,
        headers: reqHeaders,
        authenticated: false,
        status: 400,
        reason: `Invalid role parameter: ${role}`,
        elapsedTimeMs: Date.now() - startTime
      });
      return response;
    }

    // Determine lock status based on incoming user status (e.g. inactive / disabled)
    const shouldLock = status === 'inactive' || status === 'disabled';
    // 100 years lockout for inactive status
    const lockedUntil = shouldLock ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) : null;

    // 3. Perform matching and sync
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    const existingEmployee = await prisma.employee.findUnique({ where: { email } });

    let resultUser: any = null;

    if (existingAdmin) {
      if (mappedRole === 'admin') {
        // Update Admin
        resultUser = await prisma.admin.update({
          where: { id: existingAdmin.id },
          data: {
            name: name || existingAdmin.name,
            lockedUntil,
            failedAttempts: shouldLock ? existingAdmin.failedAttempts : 0,
          },
        });
      } else {
        // Transition from Admin to Employee
        console.log(`[SYNC] Transitioning ${email} from Admin to Employee.`);
        await prisma.admin.delete({ where: { id: existingAdmin.id } });
        const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedPassword = await hashPassword(randomPassword);
        resultUser = await prisma.employee.create({
          data: {
            email,
            username: email.split('@')[0],
            name: name || email.split('@')[0],
            password: hashedPassword,
            authProvider: 'SPMS',
            lockedUntil,
            isFirstLogin: false,
          },
        });
      }
    } else if (existingEmployee) {
      if (mappedRole === 'employee') {
        // Update Employee
        resultUser = await prisma.employee.update({
          where: { id: existingEmployee.id },
          data: {
            name: name || existingEmployee.name,
            lockedUntil,
            failedAttempts: shouldLock ? existingEmployee.failedAttempts : 0,
          },
        });
      } else {
        // Transition from Employee to Admin
        console.log(`[SYNC] Transitioning ${email} from Employee to Admin.`);
        await prisma.employee.delete({ where: { id: existingEmployee.id } });
        const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedPassword = await hashPassword(randomPassword);
        resultUser = await prisma.admin.create({
          data: {
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            authProvider: 'SPMS',
            lockedUntil,
          },
        });
      }
    } else {
      // Create new user record
      const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const hashedPassword = await hashPassword(randomPassword);

      if (mappedRole === 'admin') {
        resultUser = await prisma.admin.create({
          data: {
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            authProvider: 'SPMS',
            lockedUntil,
          },
        });
      } else {
        resultUser = await prisma.employee.create({
          data: {
            email,
            username: email.split('@')[0],
            name: name || email.split('@')[0],
            password: hashedPassword,
            authProvider: 'SPMS',
            lockedUntil,
            isFirstLogin: false,
          },
        });
      }
    }

    // Synchronize/upsert in global User table
    await prisma.user.upsert({
      where: { email },
      update: {
        name: name || email.split('@')[0],
        authProvider: 'SPMS',
      },
      create: {
        email,
        name: name || email.split('@')[0],
        authProvider: 'SPMS',
      },
    });

    console.log(`[SYNC SUCCESS] Synchronized user ${email} successfully as ${mappedRole}. Lock status: ${shouldLock}`);

    const response = NextResponse.json({
      success: true,
      user: {
        id: resultUser.id,
        email: resultUser.email,
        name: resultUser.name,
        role: mappedRole,
        locked: !!resultUser.lockedUntil,
      },
    });
    
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => response.headers.set(key, val));

    await logRequest({
      endpoint: '/api/internal/users/sync',
      method: 'POST',
      clientIp,
      headers: reqHeaders,
      authenticated: true,
      status: 200,
      reason: `Synchronized ${email} successfully`,
      elapsedTimeMs: Date.now() - startTime
    });

    return response;
  } catch (error: any) {
    console.error('[SYNC ERROR] Unexpected error in sync flow:', error);
    
    const response = NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    const cors = getCorsHeaders(request);
    cors.forEach((val, key) => response.headers.set(key, val));

    await logRequest({
      endpoint: '/api/internal/users/sync',
      method: 'POST',
      clientIp,
      headers: reqHeaders,
      authenticated: false,
      status: 500,
      reason: 'Unexpected error: ' + error.message,
      elapsedTimeMs: Date.now() - startTime
    });

    return response;
  }
}
