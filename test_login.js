const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'punamkhadse.sam@gmail.com';
  const employee = await prisma.employee.findUnique({ where: { email } });
  
  if (!employee) {
    console.log("Employee not found");
    return;
  }
  
  console.log("Found employee:", employee.username);
  
  const passwordsToTest = [
    `${employee.username}@123`,
    `punam@123`,
    `punam @123`
  ];
  
  for (const pwd of passwordsToTest) {
    const isMatch = await bcrypt.compare(pwd, employee.password);
    console.log(`Testing password '${pwd}': ${isMatch}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
