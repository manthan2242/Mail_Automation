const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function validateClientEmails(primaryMail, optionalMails, excludeClientId = null) {
  const allInputEmails = [primaryMail, ...optionalMails].map(e => e.trim().toLowerCase()).filter(Boolean);
  
  const existingClients = await prisma.client.findMany({
    where: excludeClientId ? { id: { not: excludeClientId } } : undefined,
    select: {
      id: true,
      name: true,
      primaryMail: true,
      secondaryMail: true,
      optionalMail: true,
    }
  });

  for (const client of existingClients) {
    const existingEmails = new Set();
    if (client.primaryMail) existingEmails.add(client.primaryMail.toLowerCase().trim());
    if (client.secondaryMail) existingEmails.add(client.secondaryMail.toLowerCase().trim());
    if (client.optionalMail) {
      client.optionalMail.split(',').forEach(e => {
        const trimmed = e.trim().toLowerCase();
        if (trimmed) existingEmails.add(trimmed);
      });
    }

    for (const email of allInputEmails) {
      if (existingEmails.has(email)) {
        return { error: `Email "${email}" is already registered under client "${client.name}"` };
      }
    }
  }
  return { success: true };
}

async function main() {
  console.log("Starting email collision prevention tests...");

  // Clean up any old test clients
  await prisma.client.deleteMany({
    where: {
      name: { in: ["Test Collision Client A", "Test Collision Client B"] }
    }
  });

  // 1. Create client A in database
  const clientA = await prisma.client.create({
    data: {
      name: "Test Collision Client A",
      primaryMail: "clienta@example.com",
      secondaryMail: "opt1@example.com",
      optionalMail: "opt2@example.com"
    }
  });
  console.log("Created Client A:", clientA.name);

  // Helper helper to test scenario
  async function runTestCase(name, pMail, optMails, excludeId = null, expectFail = true) {
    const res = await validateClientEmails(pMail, optMails, excludeId);
    if (expectFail) {
      if (res.error) {
        console.log(`[PASS] ${name}: Correctly rejected collision. Reason: ${res.error}`);
      } else {
        console.error(`[FAIL] ${name}: Expected collision error but validation passed.`);
      }
    } else {
      if (res.success) {
        console.log(`[PASS] ${name}: Correctly allowed non-colliding update/create.`);
      } else {
        console.error(`[FAIL] ${name}: Expected validation to pass but got: ${res.error}`);
      }
    }
  }

  // Test Case 2a: New client with colliding primary email
  await runTestCase(
    "Test Case 2a: Colliding primary email",
    "clienta@example.com",
    ["unique@example.com"],
    null,
    true
  );

  // Test Case 2b: New client with primary email colliding with Client A's optional email
  await runTestCase(
    "Test Case 2b: Primary email colliding with Client A's optional email",
    "opt1@example.com",
    ["unique@example.com"],
    null,
    true
  );

  // Test Case 2c: New client with optional email colliding with Client A's primary email
  await runTestCase(
    "Test Case 2c: Optional email colliding with Client A's primary email",
    "unique@example.com",
    ["clienta@example.com"],
    null,
    true
  );

  // Test Case 2d: New client with optional email colliding with Client A's optional email
  await runTestCase(
    "Test Case 2d: Optional email colliding with Client A's optional email",
    "unique@example.com",
    ["opt2@example.com"],
    null,
    true
  );

  // Test Case 2e: New client with fully unique emails
  await runTestCase(
    "Test Case 2e: Fully unique emails (New Client)",
    "clientb@example.com",
    ["opt3@example.com"],
    null,
    false
  );

  // Create Client B for update tests
  const clientB = await prisma.client.create({
    data: {
      name: "Test Collision Client B",
      primaryMail: "clientb@example.com",
      secondaryMail: "opt3@example.com"
    }
  });
  console.log("Created Client B:", clientB.name);

  // Test Case 3a: Updating Client A with its own existing emails
  await runTestCase(
    "Test Case 3a: Updating Client A with its own existing emails",
    "clienta@example.com",
    ["opt1@example.com", "opt2@example.com"],
    clientA.id,
    false
  );

  // Test Case 3b: Updating Client A with emails colliding with Client B
  await runTestCase(
    "Test Case 3b: Updating Client A with email colliding with Client B's primary",
    "clienta@example.com",
    ["clientb@example.com"],
    clientA.id,
    true
  );

  // Clean up
  await prisma.client.deleteMany({
    where: {
      name: { in: ["Test Collision Client A", "Test Collision Client B"] }
    }
  });
  console.log("Cleaned up database. All tests finished.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
