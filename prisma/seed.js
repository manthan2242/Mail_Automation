const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({});

async function main() {
  // ── 1. Seed Admin ──────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@mail.com' },
    update: {},
    create: {
      email: 'admin@mail.com',
      password: adminPassword,
      name: 'System Admin',
    },
  });
  console.log('✅ Seeded admin:', admin.email);

  // ── 2. Seed Example Email Accounts (EmailConfig) ───────────────
  const emailAccounts = [
    {
      host: 'smtp.gmail.com',
      port: 587,
      email: 'noreply@salesforcepro.com',
      password: 'app-password-here',
    },
    {
      host: 'smtp.gmail.com',
      port: 587,
      email: 'support@salesforcepro.com',
      password: 'app-password-here',
    },
    {
      host: 'smtp.gmail.com',
      port: 587,
      email: 'sales@salesforcepro.com',
      password: 'app-password-here',
    },
  ];

  const createdConfigs = [];
  for (const acc of emailAccounts) {
    const config = await prisma.emailConfig.upsert({
      where: { email: acc.email },
      update: {},
      create: acc,
    });
    createdConfigs.push(config);
    console.log('✅ Seeded email config:', config.email);
  }

  // ── 3. Seed Sample Employee ────────────────────────────────────
  const empPassword = await bcrypt.hash('Employee@123', 10);
  const employee = await prisma.employee.upsert({
    where: { email: 'employee@mail.com' },
    update: {},
    create: {
      email: 'employee@mail.com',
      username: 'employee01',
      password: empPassword,
      name: 'Sample Employee',
      isFirstLogin: false,
    },
  });
  console.log('✅ Seeded employee:', employee.email);

  // ── 4. Assign email accounts to the sample employee ────────────
  for (const config of createdConfigs) {
    await prisma.emailAssignment.upsert({
      where: {
        employeeId_emailAccountId: {
          employeeId: employee.id,
          emailAccountId: config.id,
        },
      },
      update: {},
      create: {
        employeeId: employee.id,
        emailAccountId: config.id,
      },
    });
    console.log(`✅ Assigned ${config.email} to ${employee.email}`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('────────────────────────────────────────────');
  console.log('Admin Login:    admin@mail.com  /  Admin@123');
  console.log('Employee Login: employee@mail.com  /  Employee@123');
  console.log('────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
