import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

async function validateAdmin(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  if (!token) return { error: 'Unauthorized', status: 401 };
  
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { payload };
}

export async function GET(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    console.log('[API] GET /api/admin/email-configs - Fetching SMTP configs');
    const configs = await prisma.emailConfig.findMany({
      select: {
        id: true,
        email: true,
        host: true,
        port: true,
        name: true
      }
    });
    console.log(`[API] Success: Found ${configs.length} configs`);

    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch email configs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await request.json();
    console.log('[API] POST /api/admin/email-configs - Creating SMTP config for:', data.email);
    const config = await prisma.emailConfig.create({
      data: {
        name: data.name,
        host: data.host,
        port: parseInt(data.port.toString()),
        email: data.email,
        password: data.password,
      }
    });
    console.log('[API] Success: SMTP config created in DB with ID:', config.id);

    return NextResponse.json(config);
  } catch (error) {
    console.error('[SMTP_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create SMTP config' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await request.json();
    const { id, host, port, email, password, name } = data;

    console.log('[API] PATCH /api/admin/email-configs - Updating config:', id);
    console.log('[API] Fields to update:', { host, port, email, hasPassword: !!password, name });

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const config = await prisma.emailConfig.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(host && { host }),
        ...(port && { port: parseInt(port.toString()) }),
        ...(email && { email }),
        ...(password && { password }),
      }
    });
    console.log('[API] Success: SMTP config updated');

    return NextResponse.json(config);
  } catch (error) {
    console.error('[SMTP_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update SMTP config' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await validateAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await request.json();
    
    await prisma.emailConfig.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SMTP_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete SMTP config' }, { status: 500 });
  }
}
