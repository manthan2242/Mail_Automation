const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const hashedPassword = await bcrypt.hash("Praddy@112233", 10);
  
  const admin = await prisma.admin.upsert({
    where: { email: "chardepradhumn2000@gmail.com" },
    update: {},
    create: {
      email: "chardepradhumn2000@gmail.com",
      password: hashedPassword,
      name: "Admin User",
      twoFactorEnabled: false,
    },
  });

  console.log("Admin created/updated:", admin);
  console.log("Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
