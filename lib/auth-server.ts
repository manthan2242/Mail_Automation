import { prisma } from './db';
import { hashApiKey } from './api-key';

/**
 * Validates an API key from the Authorization header.
 * This should ONLY be used in API routes (Server Runtime).
 * It is NOT compatible with Edge Runtime (Middleware).
 */
export const validateApiKey = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const rawKey = authHeader.split(' ')[1];
  const hashedKey = hashApiKey(rawKey);

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { 
      hashedKey,
      isActive: true
    },
    include: { admin: true }
  });

  if (!apiKeyRecord) return null;

  return {
    id: apiKeyRecord.adminId,
    email: apiKeyRecord.admin.email,
    role: 'admin' as const,
    name: apiKeyRecord.admin.name
  };
};
