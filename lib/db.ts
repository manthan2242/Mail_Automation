import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL || '';
const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'unknown';
console.log(`[DATABASE] Prisma connecting to: ${dbName} (from URL)`);
console.log('[DATABASE] Env Variable exists:', !!process.env.DATABASE_URL);

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'info' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

  // @ts-ignore
  client.$on('query', (e: any) => {
    console.log(`[PRISMA QUERY] ${e.query} -- Params: ${e.params}`);
  });

  return client;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
