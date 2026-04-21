const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const configs = await prisma.emailConfig.findMany();
  console.log('Configs found:', configs.length);
  configs.forEach(c => console.log(' -', c.email));
  await prisma.$disconnect();
}

check();
