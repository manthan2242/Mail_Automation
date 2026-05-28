import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ==========================================
  // CHANGE THESE TO YOUR PREFERRED CREDENTIALS
  // ==========================================
  const email = 'chardepradhumn2000@gmail.com';
  const name = 'Admin';
  const password = 'Praddy@112233';
  // ==========================================

  console.log(`[CREATE ADMIN] Attempting to create admin: ${email}`);

  // Hashing password with bcrypt (the same method the app uses)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Creates the admin, or updates their password if they already exist
  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
    },
    create: {
      email,
      password: hashedPassword,
      name,
    },
  });

  console.log(`[CREATE ADMIN] Success! Admin account created: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
