import { prisma } from './db';
import { sendEmail } from './email';
import { checkAndIncrementTargets } from './target-tracker';

export function startEmailScheduler() {
  const globalAny = globalThis as any;
  if (globalAny.schedulerInterval) {
    console.log('[SCHEDULER] Already running, skipping start.');
    return;
  }

  console.log('[SCHEDULER] Starting background scheduled email worker...');
  globalAny.schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Find all scheduled emails that are due
      const emailsToSend = await prisma.email.findMany({
        where: {
          status: 'SCHEDULED',
          // @ts-ignore
          scheduledAt: {
            lte: now
          }
        },
        include: {
          employee: {
            select: { name: true, email: true }
          }
        }
      });

      if (emailsToSend.length === 0) return;

      console.log(`[SCHEDULER] Found ${emailsToSend.length} scheduled emails due to send.`);

      for (const email of emailsToSend) {
        console.log(`[SCHEDULER] Sending scheduled email ${email.id} to ${email.to}`);
        
        // Mark as SENT immediately to prevent other intervals from picking it up
        await prisma.email.update({
          where: { id: email.id },
          data: { status: 'SENT' }
        });

        let senderName: string | undefined;
        if (email.adminSenderId) {
          const admin = await prisma.admin.findUnique({
            where: { id: email.adminSenderId },
            select: { name: true }
          });
          if (admin) {
            senderName = admin.name;
          }
        // @ts-ignore
        } else if (email.employee) {
          // @ts-ignore
          senderName = email.employee.name;
        }

        const attachments = email.attachments ? JSON.parse(email.attachments) : undefined;

        sendEmail(email.to!, email.subject, email.body, {
          replyTo: email.fromEmail || undefined,
          emailConfigId: email.configId || undefined,
          cc: email.cc || undefined,
          bcc: email.bcc || undefined,
          attachments,
          senderName
        }).then(() => {
          console.log(`[SCHEDULER] Successfully sent email ${email.id}`);
          // Trigger target tracker
          checkAndIncrementTargets(email.to!, email.subject, email.cc || null, email.bcc || null).catch(err => {
            console.error('[SCHEDULER TRACKER ERROR]:', err);
          });
        }).catch(async (err: any) => {
          console.error(`[SCHEDULER ERROR] Failed to send email ${email.id}:`, err.message);
          await prisma.email.update({
            where: { id: email.id },
            data: {
              status: 'FAILED',
              adminComment: `Scheduler Send Error: ${err.message}`
            }
          });
        });
      }
    } catch (error) {
      console.error('[SCHEDULER INTERVAL ERROR]:', error);
    }
  }, 30000); // Check every 30 seconds
}
