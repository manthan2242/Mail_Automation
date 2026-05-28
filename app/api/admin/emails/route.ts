import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      include: {
        employee: {
          select: { name: true, email: true }
        },
        config: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('Email GET Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status, adminComment, subject, body } = await request.json();
    
    // Validate email exists and get employee details
    const emailData = await prisma.email.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!emailData) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Update the email
    const updatedEmail = await prisma.email.update({
      where: { id },
      data: { 
        status, 
        adminComment,
        ...(subject && { subject }),
        ...(body && { body })
      },
    });

    // Notify employee of status change
    if (emailData.employee?.email) {
      try {
        await sendEmail(
          emailData.employee.email,
          `Request ${status === 'APPROVED' ? 'Approved' : 'Rejected'}: ${updatedEmail.subject}`,
          `Hi ${emailData.employee.name},\n\nYour request for "${updatedEmail.subject}" has been ${status.toLowerCase()}.${adminComment ? `\n\nAdmin Note: ${adminComment}` : ''}`,
          { noBcc: true }
        );
      } catch (e) {
        console.warn('[NOTIFY ERROR]: Status notification failed', e);
      }
    }

    return NextResponse.json(updatedEmail);
  } catch (error: any) {
    console.error('Email PATCH Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update email',
      details: error.message 
    }, { status: 500 });
  }
}
