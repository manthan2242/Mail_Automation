import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { NextResponse } from 'next/server';
import { AUTH_CONFIG } from '@/lib/constants';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany();
    
    let updatedCount = 0;
    
    for (const emp of employees) {
      const trimmedUsername = emp.username.trim();
      
      // If there was a trailing space or we just want to forcefully reset to the default template
      if (emp.username !== trimmedUsername || true) {
        const correctPassword = AUTH_CONFIG.DEFAULT_PASSWORD_TEMPLATE(trimmedUsername);
        const hashedPassword = await hashPassword(correctPassword);
        
        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            username: trimmedUsername,
            password: hashedPassword,
          }
        });
        updatedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Fixed ${updatedCount} employees. Their password has been reset to the default template.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
