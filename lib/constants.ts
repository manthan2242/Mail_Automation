/**
 * Global application constants.
 * NEXT_PUBLIC_* vars are available client + server.
 * Non-prefixed vars are server-only — guards use typeof window check.
 */

if (!process.env.NEXT_PUBLIC_APP_NAME) throw new Error('NEXT_PUBLIC_APP_NAME is not defined');
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME;

if (!process.env.NEXT_PUBLIC_DEFAULT_DOMAINS) throw new Error('NEXT_PUBLIC_DEFAULT_DOMAINS is not defined');
export const DEFAULT_DOMAINS = process.env.NEXT_PUBLIC_DEFAULT_DOMAINS.split(',');

if (!process.env.NEXT_PUBLIC_APP_URL) throw new Error('NEXT_PUBLIC_APP_URL is not defined');
export const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Server-only constants — only validated when accessed on the server
export const AI_MODEL_NAME = process.env.AI_MODEL_NAME || 'gemini-2.0-flash';

export const OTP_COOLDOWN_SECONDS = parseInt(process.env.OTP_COOLDOWN_SECONDS || '60');
export const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');

export const EMAIL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT: 'SENT',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;
