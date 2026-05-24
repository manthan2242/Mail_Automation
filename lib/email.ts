import nodemailer from 'nodemailer';
import { prisma } from './db';

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

  const transporter = nodemailer.createTransport({
    ...(service ? { service } : { host, port, secure: port === 465 }),
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });

  const fromEmail = opts.replyTo || process.env.FROM_EMAIL || user;
  
  // Convert arrays to comma-separated strings for nodemailer
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const ccStr = Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc;
  const bccStr = Array.isArray(opts.bcc) ? opts.bcc.join(', ') : opts.bcc;
  
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Mail Automation" <${fromEmail}>`,
    to: toStr,
    ...(ccStr && { cc: ccStr }),
    subject,
    html: text?.replace(/\n/g, '<br/>'),
    ...(opts.noBcc ? {} : { bcc: bccStr ? `${bccStr},${fromEmail}` : fromEmail }),
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
