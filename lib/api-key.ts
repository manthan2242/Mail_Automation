import crypto from 'crypto';

/**
 * Generates a secure random API key.
 * Format: sp_<32 hex chars>
 */
export function generateApiKey(): string {
  return `sp_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Hashes an API key using SHA-256.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Masks an API key for safe display.
 * Example: sp_****abcd
 */
export function maskApiKey(key: string): string {
  const prefix = key.substring(0, 3); // 'sp_'
  const lastFour = key.substring(key.length - 4);
  return `${prefix}${'*'.repeat(key.length - 7)}${lastFour}`;
}
