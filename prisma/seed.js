const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({});

async function main() {
  // ── 1. Seed Admin ──────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminPasswordRaw = process.env.ADMIN_PASSWORD!;
  const adminPassword = await bcrypt.hash(adminPasswordRaw, 10);
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

  const createdConfigs = [];

  // ── 3. Seed Sample Employee ────────────────────────────────────
  const empEmail = process.env.EMPLOYEE_EMAIL!;
  const empPasswordRaw = process.env.EMPLOYEE_PASSWORD!;
  const empPassword = await bcrypt.hash(empPasswordRaw, 10);
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
  console.log(`Admin Login:    ${adminEmail}  /  ${adminPasswordRaw}`);
  console.log(`Employee Login: ${empEmail}  /  ${empPasswordRaw}`);
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
