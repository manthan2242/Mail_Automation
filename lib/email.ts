import nodemailer from 'nodemailer';
import { prisma } from './db';

// Cache structure on globalThis to persist SMTP transporters across requests/reloads
const globalForTransporters = globalThis as unknown as {
  transporters: Record<string, any>;
};

if (!globalForTransporters.transporters) {
  globalForTransporters.transporters = {};
}


/**
 * Sends an email via SMTP.
 * Resolves credentials from: env vars → database EmailConfig → error.
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  text: string,
  options?: {
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    noBcc?: boolean;
    emailConfigId?: string;
    attachments?: { filename: string; content: string; contentType?: string }[];
  },
  emailConfigId?: string // Keep for backwards compatibility
) => {
  // Handle backwards compatibility
  const opts = {
    replyTo: options?.replyTo,
    cc: options?.cc,
    bcc: options?.bcc,
    noBcc: options?.noBcc || false,
    emailConfigId: options?.emailConfigId || emailConfigId
  };

  let user = process.env.EMAIL_USER || process.env.SMTP_USER;
  let pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  let host = process.env.SMTP_HOST;
  let port = parseInt(process.env.SMTP_PORT || '587');
  let service: string | undefined = (host?.includes('gmail') || host?.includes('google.com')) ? 'gmail' : undefined;

  const isPlaceholder = (u?: string, p?: string) => 
    !u || !p || u.includes('example.com') || p.includes('your-') || p === 'app-password-here';

  // 1. If a specific config ID was provided, use that config from DB
  if (opts.emailConfigId && opts.emailConfigId !== 'default') {
    const config = await prisma.emailConfig.findUnique({
      where: { id: opts.emailConfigId }
    });
    if (config && !isPlaceholder(config.email, config.password)) {
      user = config.email;
      pass = config.password;
      host = config.host;
      port = config.port;
      service = config.host?.includes('gmail') ? 'gmail' : undefined;
    }
  } 
  
  // 2. If no valid config from DB (or 'default' requested), use .env (already set above)
  
  // 3. Final safety check
  if (isPlaceholder(user, pass)) {
    console.error('[SMTP CONFIG ERROR]: No valid SMTP credentials found.');
    throw new Error('Email credentials are not configured. Please set EMAIL_USER/PASS in .env or add an SMTP config in the Admin panel.');
  }

  const cacheKey = `${user}_${pass}_${host || ''}_${port || 587}_${service || ''}`;
  let transporter = globalForTransporters.transporters[cacheKey];

  if (!transporter) {
    console.log(`[SMTP CACHE MISS]: Creating new SMTP transporter connection pool for ${user}`);
    transporter = nodemailer.createTransport({
      ...(service ? { service } : { host, port, secure: port === 465 }),
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      idleTimeout: 30000 // Close idle connections after 30 seconds
    } as any);
    globalForTransporters.transporters[cacheKey] = transporter;
  } else {
    console.log(`[SMTP CACHE HIT]: Reusing active SMTP transporter connection pool for ${user}`);
  }

  const fromEmail = opts.replyTo || process.env.FROM_EMAIL || user;
  
  // Convert arrays to comma-separated strings for nodemailer
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const ccStr = Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc;
  const bccStr = Array.isArray(opts.bcc) ? opts.bcc.join(', ') : opts.bcc;
  
  // Parse attachments if present
  const nodemailerAttachments = options?.attachments?.map((att: any) => {
    const dataUrlRegex = /^data:(.*?);base64,(.*)$/;
    const match = dataUrlRegex.exec(att.content);
    if (match) {
      return {
        filename: att.filename,
        content: match[2],
        encoding: 'base64',
        contentType: match[1]
      };
    }
    return {
      filename: att.filename,
      content: att.content,
      contentType: att.contentType
    };
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Mail Automation" <${fromEmail}>`,
    to: toStr,
    ...(ccStr && { cc: ccStr }),
    subject,
    html: text?.replace(/\n/g, '<br/>'),
    ...(opts.noBcc ? {} : { bcc: bccStr ? `${bccStr},${fromEmail}` : fromEmail }),
    ...(nodemailerAttachments && { attachments: nodemailerAttachments })
  };

  try {
    console.log(`[SMTP PRE-SEND]: From: ${fromEmail}, To: ${toStr} via ${host}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS]: Email delivered to ${toStr}. ID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`[SMTP FATAL ERROR]:`, {
      code: error.code,
      command: error.command,
      response: error.response
    });

    if (error.code === 'EAUTH') {
      throw new Error('SMTP Authentication failed. Ensure you are using a 16-character Gmail App Password.');
    }

    throw new Error(error.message || 'Failed to deliver email through SMTP gateway.');
  }
};

/**
 * Validates list of attachments for forbidden file extensions and size limit (max 5MB).
 * Returns an error string if invalid, or null if valid.
 */
export function validateAttachments(attachments: any): string | null {
  if (!attachments) return null;
  if (!Array.isArray(attachments)) {
    return 'Attachments must be an array';
  }

  const blockedExtensions = ['.exe', '.scr', '.bat', '.sh', '.vbs', '.cmd', '.msi', '.com', '.pif'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB

  for (const att of attachments) {
    if (!att || typeof att !== 'object') {
      return 'Invalid attachment format';
    }
    const { filename, content } = att;
    if (!filename || typeof filename !== 'string') {
      return 'Attachment filename is required';
    }
    if (!content || typeof content !== 'string') {
      return 'Attachment content is required';
    }

    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1) {
      continue;
    }
    const ext = filename.slice(dotIndex).toLowerCase();
    if (blockedExtensions.includes(ext)) {
      return `File type "${ext}" is blocked for security reasons`;
    }

    let base64Data = content;
    if (content.includes(';base64,')) {
      base64Data = content.split(';base64,')[1];
    }
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > maxSizeBytes) {
      return `File "${filename}" exceeds the maximum size limit of 5MB`;
    }
  }

  return null;
}
