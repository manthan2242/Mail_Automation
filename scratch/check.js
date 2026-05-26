const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- Checking SQLite Database Contents ---");
  
  const admins = await prisma.admin.findMany();
  console.log(`Admins (${admins.length}):`, admins.map(a => ({ id: a.id, email: a.email, name: a.name })));
  
  const employees = await prisma.employee.findMany();
  console.log(`Employees (${employees.length}):`, employees.map(e => ({ id: e.id, email: e.email, name: e.name })));
  
  const contacts = await prisma.contact.findMany();
  console.log(`Contacts (${contacts.length}):`, contacts.map(c => ({ id: c.id, email: c.email, name: c.name })));
  
  const emailConfigs = await prisma.emailConfig.findMany();
  console.log(`EmailConfigs (${emailConfigs.length}):`, emailConfigs.map(c => ({ id: c.id, email: c.email })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
