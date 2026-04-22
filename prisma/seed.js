const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({});

async function main() {
  // ── 1. Seed Admin ──────────────────────────────────────────────
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL;
  const adminRawPassword = process.env.SYSTEM_ADMIN_PASSWORD;
  
  if (!adminEmail || !adminRawPassword) {
    throw new Error('SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD must be set in .env for seeding.');
  }

  const adminPassword = await bcrypt.hash(adminRawPassword, 10);
  
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminPassword,
      name: 'System Admin',
    },
  });
  console.log('✅ Seeded admin:', admin.email);

  // ── 2. Seed Example Email Accounts (EmailConfig) ───────────────
  const emailAccounts = []; // No longer seeding hardcoded accounts
  
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
  const empEmail = process.env.SAMPLE_EMPLOYEE_EMAIL;
  const empRawPassword = process.env.SAMPLE_EMPLOYEE_PASSWORD;

  if (!empEmail || !empRawPassword) {
    console.warn('⚠️ SAMPLE_EMPLOYEE_EMAIL or SAMPLE_EMPLOYEE_PASSWORD not set. Skipping employee seed.');
  } else {
    const empPassword = await bcrypt.hash(empRawPassword, 10);

    const employee = await prisma.employee.upsert({
      where: { email: empEmail },
      update: {},
      create: {
        email: empEmail,
        username: 'employee01',
        password: empPassword,
        name: 'Sample Employee',
        isFirstLogin: false,
      },
    });
    console.log('✅ Seeded employee:', employee.email);
  }

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
  console.log(`Admin Login:    ${adminEmail}  /  ${adminRawPassword}`);
  console.log(`Employee Login: ${empEmail}  /  ${empRawPassword}`);
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
