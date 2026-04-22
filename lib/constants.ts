/**
 * Application-wide constants and fallback values.
 * Moving hardcoded strings here makes the app more maintainable and configurable.
 */

export const APP_CONFIG = {
  NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Sales Force Pro',
  DEFAULT_SENDER: process.env.NEXT_PUBLIC_DEFAULT_SENDER || '',
  SYSTEM_EMAIL: process.env.NEXT_PUBLIC_SYSTEM_EMAIL || '',
  SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
};

export const EMAIL_SUBJECTS = {
  OTP: (appName: string) => `[${appName}] Verification Code`,
  NOTIFICATION: (appName: string) => `Notification from ${appName}`,
  DEFAULT_SUBJECT: (appName: string) => `New Message from ${appName}`,
  WELCOME: (appName: string) => `Welcome to ${appName} - Your Credentials`,
};

export const AUTH_CONFIG = {
  OTP_COOLDOWN_SECONDS: 60,
  OTP_EXPIRY_MINUTES: 5,
  DEFAULT_PASSWORD_TEMPLATE: (username: string) => `${username}@123`,
  JWT_SECRET_FALLBACK: process.env.JWT_SECRET_FALLBACK || '',
  JWT_EXPIRATION: '1d',
};

export const SMTP_DEFAULTS = {
  HOST: process.env.SMTP_HOST_FALLBACK || '',
  PORT: parseInt(process.env.SMTP_PORT_FALLBACK || '0'),
};

export const AI_CONFIG = {
  MODEL_NAME: process.env.AI_MODEL_NAME || 'gemini-1.5-flash',
  RETRIES: 5,
};

