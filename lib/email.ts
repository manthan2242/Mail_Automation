import 'dotenv/config';
import nodemailer from 'nodemailer';

console.log('[DEBUG] SMTP User:', process.env.EMAIL_USER);

/**
 * Sends an email via Gmail SMTP Service.
 * Uses process.env.EMAIL_USER and process.env.EMAIL_PASS (Gmail App Password).
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
  let host = process.env.SMTP_HOST || 'smtp.gmail.com';
  let port = parseInt(process.env.SMTP_PORT || '587');
  let service: string | undefined = host.includes('gmail') ? 'gmail' : undefined;

  // Database Fallback: If environment variables are missing or placeholders, try to find a configuration in the DB
  const { prisma } = require('./db');
  
  if (emailConfigId) {
    const config = await prisma.emailConfig.findUnique({
      where: { id: emailConfigId }
    });
    if (config) {
      user = config.email;
      pass = config.password;
      host = config.host;
      port = config.port;
      service = host.includes('gmail') ? 'gmail' : undefined;
    }
  } else if (!user || user.includes('example.com') || !pass || pass === 'your-password') {
    // Try to get the first available config as a system default if env vars are placeholders
    const defaultConfig = await prisma.emailConfig.findFirst();
    if (defaultConfig) {
      console.log(`[SMTP] Using database fallback config: ${defaultConfig.email}`);
      user = defaultConfig.email;
      pass = defaultConfig.password;
      host = defaultConfig.host;
      port = defaultConfig.port;
      service = host.includes('gmail') ? 'gmail' : undefined;
    }
  }

  if (!user || !pass || user.includes('example.com')) {
    console.error("[SMTP CONFIG ERROR]: No valid SMTP credentials found in environment or database.");
    throw new Error('Email credentials are not configured. Please set EMAIL_USER/PASS in .env or add an SMTP config in the Admin panel.');
  }


  // Robust Transporter
  const transporter = nodemailer.createTransport({
    ...(service ? { service } : { host, port, secure: port === 465 }),
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: replyTo ? `"${replyTo}" <${user}>` : `"Sales Force Pro" <${user}>`,
    to,
    subject,
    html: text?.replace(/\n/g, '<br/>'), // Convert line breaks to HTML for proper formatting
    ...(noBcc ? {} : { bcc: replyTo || user }),
    replyTo: replyTo || user,
  };

  try {
    console.log(`[SMTP PRE-SEND]: From: ${mailOptions.from}, To: ${mailOptions.to}, BCC: ${mailOptions.bcc}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS]: Email delivered to ${to} (BCC to ${replyTo || user}). ID: ${info.messageId}`);
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
