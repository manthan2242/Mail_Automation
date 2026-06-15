import { prisma } from './db';

/**
 * Checks if the current date is in a different calendar period than the last reset date.
 */
export function shouldReset(frequency: string, lastReset: Date): boolean {
  const now = new Date();
  const resetDate = new Date(lastReset);

  if (frequency === 'DAILY') {
    return now.toDateString() !== resetDate.toDateString();
  }
  
  if (frequency === 'WEEKLY') {
    const getStartOfWeek = (d: Date) => {
      const temp = new Date(d);
      const day = temp.getDay();
      const diff = temp.getDate() - day;
      return new Date(temp.setDate(diff)).toDateString();
    };
    return getStartOfWeek(now) !== getStartOfWeek(resetDate);
  }
  
  if (frequency === 'MONTHLY') {
    return now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();
  }
  
  return false;
}

/**
 * Extracts raw email address from formatted strings like "John Doe <john@example.com>"
 */
function extractEmail(emailString: string): string {
  const clean = emailString.trim();
  const match = /<([^>]+)>/.exec(clean);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return clean.toLowerCase();
}

/**
 * Checks outgoing emails against target metrics, executing period resets and target increments.
 */
export async function checkAndIncrementTargets(
  to: string | null | undefined,
  subject: string,
  cc?: string | null | undefined,
  bcc?: string | null | undefined
) {
  console.log(`\n=== [TARGET TRACKER START] ===`);
  console.log(`[TRACKER INPUT] Raw To: "${to}", CC: "${cc}", BCC: "${bcc}", Subject: "${subject}"`);

  if (!to && !cc && !bcc) {
    console.log(`[TRACKER SKIP] Missing recipient fields.`);
    return;
  }

  if (!subject) {
    console.log(`[TRACKER SKIP] Missing 'subject' field.`);
    return;
  }

  try {
    // 1. Clean and extract raw emails
    const emailsToCheck: string[] = [];
    const addEmails = (fieldVal?: string | null) => {
      if (!fieldVal) return;
      fieldVal
        .split(',')
        .map(e => extractEmail(e))
        .filter(Boolean)
        .forEach(e => {
          if (!emailsToCheck.includes(e)) {
            emailsToCheck.push(e);
          }
        });
    };

    addEmails(to);
    addEmails(cc);
    addEmails(bcc);

    console.log(`[TRACKER PARSED] Cleaned Emails to check:`, emailsToCheck);

    if (emailsToCheck.length === 0) {
      console.log(`[TRACKER SKIP] No valid email addresses found after parsing.`);
      return;
    }

    // 2. Fetch all clients with their projects and targets to perform in-memory robust matching
    // (This guarantees case-insensitivity and formatting compatibility across all databases)
    const allClients = await prisma.client.findMany({
      include: {
        projects: true,
        targets: true
      }
    });

    console.log(`[TRACKER DB] Retrieved ${allClients.length} clients to check against.`);

    let matchCount = 0;

    for (const client of allClients) {
      // Collect all configured emails for this client
      const clientEmails: string[] = [];
      if (client.primaryMail) clientEmails.push(client.primaryMail.trim().toLowerCase());
      if (client.secondaryMail) {
        client.secondaryMail.split(',').forEach(e => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) clientEmails.push(trimmed);
        });
      }
      if (client.optionalMail) {
        client.optionalMail.split(',').forEach(e => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) clientEmails.push(trimmed);
        });
      }

      console.log(`[TRACKER DEBUG] Comparing client "${client.name}": Configured client emails =`, clientEmails, `vs emailsToCheck =`, emailsToCheck);

      // Check if there is any intersection between clientEmails and emailsToCheck
      const recipientMatchesClient = emailsToCheck.some(email => clientEmails.includes(email.trim().toLowerCase()));

      if (!recipientMatchesClient) {
        console.log(`[TRACKER DEBUG] Skip client "${client.name}". No email match found.`);
        continue;
      }

      console.log(`[TRACKER MATCH] Recipient matched client: "${client.name}" (Emails: ${clientEmails.join(', ')})`);

      for (const project of client.projects) {
        const cleanSubject = subject.toLowerCase();
        const cleanProjName = project.name.toLowerCase();
        const cleanShortName = project.shortName?.toLowerCase();
        // @ts-ignore
        const cleanShortName2 = project.shortName2?.toLowerCase();

        const fullMatch = cleanSubject.includes(cleanProjName);
        const shortMatch = cleanShortName ? cleanSubject.includes(cleanShortName) : false;
        const shortMatch2 = cleanShortName2 ? cleanSubject.includes(cleanShortName2) : false;

        console.log(`[TRACKER COMPARE] Project: "${project.name}" (Short1: "${project.shortName || 'None'}", Short2: "${(project as any).shortName2 || 'None'}"). Full Match: ${fullMatch}, Short1 Match: ${shortMatch}, Short2 Match: ${shortMatch2}`);

        if (fullMatch || shortMatch || shortMatch2) {
          console.log(`[TRACKER PROJECT MATCH] Matched project: "${project.name}"`);
          
          // Find target config for this project
          const target = client.targets.find(t => t.projectId === project.id);
          if (target) {
            matchCount++;
            
            // Auto-Reset period check
            const needsReset = shouldReset(target.frequency, target.lastReset);
            const baseCount = needsReset ? 0 : target.currentCount;
            
            const nextCount = baseCount + 1;
            const completed = nextCount >= target.mailCount;

            console.log(`[TRACKER UPDATE] Target found (ID: ${target.id}). Reset Needed: ${needsReset}. Count: ${baseCount} -> ${nextCount} (Target limit: ${target.mailCount})`);

            await prisma.target.update({
              where: { id: target.id },
              data: {
                currentCount: nextCount,
                isCompleted: completed,
                lastReset: needsReset ? new Date() : target.lastReset
              }
            });
            console.log(`[TRACKER SUCCESS] Database target updated!`);
          } else {
            console.log(`[TRACKER WARN] No Target SLA configured for client: "${client.name}" & project: "${project.name}"`);
          }
        }
      }
    }

    console.log(`=== [TARGET TRACKER END] Matches processed: ${matchCount} ===\n`);
  } catch (error) {
    console.error('[TARGET TRACKER FATAL ERROR]:', error);
  }
}
