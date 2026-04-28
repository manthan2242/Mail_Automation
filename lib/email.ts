import nodemailer from 'nodemailer';
import { prisma } from './db';

/**
 * Sends an email via SMTP.
 * Resolves credentials from: env vars → database EmailConfig → error.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  replyTo?: string,
  emailConfigId?: string,
  noBcc: boolean = false
) => {
  let user = process.env.EMAIL_USER || process.env.SMTP_USER;
  let pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  let host = process.env.SMTP_HOST;
  let port = parseInt(process.env.SMTP_PORT || '587');
  let service: string | undefined = host?.includes('gmail') ? 'gmail' : undefined;

  const isPlaceholder = (u?: string, p?: string) => 
    !u || !p || u.includes('example.com') || p.includes('your-') || p === 'app-password-here';

  // If a specific config ID was provided, use that config from DB
  if (emailConfigId) {
    const config = await prisma.emailConfig.findUnique({
      where: { id: emailConfigId }
    });
    if (config && !isPlaceholder(config.email, config.password)) {
      user = config.email;
      pass = config.password;
      host = config.host;
      port = config.port;
      service = config.host?.includes('gmail') ? 'gmail' : undefined;
    }
  } 
  
  // If still using placeholders or no config found, fall back to DB or Env
  if (isPlaceholder(user, pass)) {
    const validConfig = await prisma.emailConfig.findFirst({
      where: {
        AND: [
          { password: { not: 'app-password-here' } },
          { password: { not: { contains: 'placeholder' } } }
        ]
      }
    });

    if (validConfig) {
      console.log(`[SMTP] Using database fallback config: ${validConfig.email}`);
      user = validConfig.email;
      pass = validConfig.password;
      host = validConfig.host;
      port = validConfig.port;
      service = validConfig.host?.includes('gmail') ? 'gmail' : undefined;
    }
  }

  if (!user || !pass || user.includes('example.com')) {
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

  const fromEmail = replyTo || process.env.FROM_EMAIL || user;
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Sales Force Pro" <${fromEmail}>`,
    to,
    subject,
    html: text?.replace(/\n/g, '<br/>'),
    ...(noBcc ? {} : { bcc: fromEmail }),
    replyTo: fromEmail,
  };

  try {
    console.log(`[SMTP PRE-SEND]: From: ${fromEmail}, To: ${to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS]: Email delivered to ${to}. ID: ${info.messageId}`);
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
