import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.toLowerCase() || '';

    if (!query) {
      return NextResponse.json([]);
    }

    // 1. Fetch matching Employees (internal emails)
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { email: true, name: true },
      take: 5,
    });

    // 2. Fetch matching Admins
    const admins = await prisma.admin.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { email: true, name: true },
      take: 5,
    });

    // 3. Fetch matching saved Contacts
    // Note: Wrapping in try-catch in case the migration hasn't run yet
    let contacts: { name: string, email: string }[] = [];
    try {
      contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { email: true, name: true },
        take: 5,
      });
    } catch (e) {
      console.warn('Contact table might not exist yet:', e);
    }

    // 4. Fetch matching Email History (distinct "TO" addresses)
    const history = await prisma.email.findMany({
      where: {
        senderId: payload.id,
        to: { contains: query, mode: 'insensitive' },
      },
      select: { to: true },
      distinct: ['to'],
      take: 5,
    });

    // Combine and format suggestions
    const suggestions = [
      ...employees.map(e => ({ name: e.name, email: e.email, type: 'internal' })),
      ...admins.map(a => ({ name: a.name, email: a.email, type: 'admin' })),
      ...contacts.map(c => ({ name: c.name, email: c.email, type: 'contact' })),
      ...history.map(h => ({ 
        name: h.to?.split('@')[0] || 'Unknown', 
        email: h.to as string, 
        type: 'history' 
      })),
    ];

    // 5. Domain Autocomplete (Gmail style)
    if (query.includes('@')) {
      const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
      const [prefix, domainPart] = query.split('@');
      if (prefix) {
        const domainMatches = DOMAINS
          .filter(d => d.startsWith(domainPart))
          .map(d => ({ 
            name: `${prefix}@${d}`, 
            email: `${prefix}@${d}`, 
            type: 'domain_suggest' 
          }));
        
        suggestions.push(...domainMatches);
      }
    }

    // Remove duplicates based on email
    const uniqueMap = new Map();
    suggestions.forEach(item => {
      if (!uniqueMap.has(item.email)) {
        uniqueMap.set(item.email, item);
      }
    });

    const finalSuggestions = Array.from(uniqueMap.values()).slice(0, 15);


    return NextResponse.json(finalSuggestions);
  } catch (error: any) {
    console.error('Email Suggestions Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
