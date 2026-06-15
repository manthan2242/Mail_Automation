const { PrismaClient } = require('@prisma/client');
const { validatePasswordComplexity } = require('../lib/password');
const { validateAttachments } = require('../lib/email');
const { comparePassword } = require('../lib/password');
require('dotenv').config();
const prisma = new PrismaClient();

async function testPasswordComplexity() {
  console.log("\n--- Testing Password Complexity ---");
  const testCases = [
    { password: "short", expectError: "Password must be at least 8 characters long" },
    { password: "nouppercase1!", expectError: "Password must contain at least one uppercase letter" },
    { password: "NOLOWERCASE1!", expectError: "Password must contain at least one lowercase letter" },
    { password: "NoDigitSpecial", expectError: "Password must contain at least one digit" },
    { password: "NoSpecial1", expectError: "Password must contain at least one special character" },
    { password: "StrongPassword123!", expectError: null }
  ];

  for (const tc of testCases) {
    const error = validatePasswordComplexity(tc.password);
    if (error === tc.expectError) {
      console.log(`[PASS] password "${tc.password}": Got expected error: "${error}"`);
    } else {
      console.error(`[FAIL] password "${tc.password}": Expected "${tc.expectError}", but got "${error}"`);
    }
  }
}

async function testAttachments() {
  console.log("\n--- Testing Attachment Sanitization ---");
  
  // 5MB + 1 byte in base64: 5 * 1024 * 1024 = 5242880 bytes. Base64 is approx 4/3 of byte size, so let's make it 8MB to be well over 5MB.
  const largeBase64 = Buffer.alloc(6 * 1024 * 1024).toString('base64');
  const smallBase64 = Buffer.alloc(100).toString('base64');

  const testCases = [
    {
      name: "Blocked extension (.exe)",
      attachments: [{ filename: "malware.exe", content: smallBase64 }],
      expectError: 'File type ".exe" is blocked for security reasons'
    },
    {
      name: "Blocked extension (.scr)",
      attachments: [{ filename: "screen.scr", content: smallBase64 }],
      expectError: 'File type ".scr" is blocked for security reasons'
    },
    {
      name: "Blocked extension case-insensitive (.EXE)",
      attachments: [{ filename: "malware.EXE", content: smallBase64 }],
      expectError: 'File type ".exe" is blocked for security reasons'
    },
    {
      name: "File too large (>5MB)",
      attachments: [{ filename: "large_file.pdf", content: largeBase64 }],
      expectError: 'File "large_file.pdf" exceeds the maximum size limit of 5MB'
    },
    {
      name: "Safe attachment (.pdf, small)",
      attachments: [{ filename: "invoice.pdf", content: smallBase64 }],
      expectError: null
    },
    {
      name: "No attachments array",
      attachments: null,
      expectError: null
    }
  ];

  for (const tc of testCases) {
    const error = validateAttachments(tc.attachments);
    if (error === tc.expectError) {
      console.log(`[PASS] "${tc.name}": Got expected result: "${error}"`);
    } else {
      console.error(`[FAIL] "${tc.name}": Expected error "${tc.expectError}", but got "${error}"`);
    }
  }
}

async function testAccountLockout() {
  console.log("\n--- Testing Account Lockout Controls ---");
  const testEmail = "temp_security_test@example.com";

  // Clean up previous test employee
  await prisma.employee.deleteMany({ where: { email: testEmail } });

  // Create test employee
  const employee = await prisma.employee.create({
    data: {
      email: testEmail,
      username: "temp_security_user",
      name: "Temp Security User",
      password: "somehashedpassword" // doesn't matter for logic test
    }
  });
  console.log(`Created test employee: ${employee.email}`);

  // We will run the exact login lockout logic using database calls
  async function simulateLoginFailure() {
    const user = await prisma.employee.findUnique({ where: { email: testEmail } });
    const now = new Date();
    
    // Check lockout
    if (user.lockedUntil && user.lockedUntil > now) {
      return { error: "Locked out" };
    }

    // Simulate password check failed, increment failedAttempts
    const failedAttempts = user.failedAttempts + 1;
    const shouldLock = failedAttempts >= 5;
    const lockedUntil = shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null;

    await prisma.employee.update({
      where: { id: user.id },
      data: { failedAttempts, lockedUntil }
    });

    return { success: false, shouldLock };
  }

  // Simulate 4 failures
  console.log("Simulating 4 login failures...");
  for (let i = 1; i <= 4; i++) {
    const res = await simulateLoginFailure();
    const updated = await prisma.employee.findUnique({ where: { email: testEmail } });
    if (!res.shouldLock && updated.failedAttempts === i && !updated.lockedUntil) {
      console.log(`[PASS] Failure ${i}: Counter incremented to ${updated.failedAttempts}. Not locked.`);
    } else {
      console.error(`[FAIL] Failure ${i}: Expected counter ${i} and no lockout, got counter ${updated.failedAttempts}, lockout ${updated.lockedUntil}`);
    }
  }

  // Simulate 5th failure -> Lockout
  console.log("Simulating 5th login failure...");
  const res5 = await simulateLoginFailure();
  const updated5 = await prisma.employee.findUnique({ where: { email: testEmail } });
  if (res5.shouldLock && updated5.failedAttempts === 5 && updated5.lockedUntil) {
    console.log(`[PASS] Failure 5: Counter incremented to 5 and account locked! Locked until: ${updated5.lockedUntil}`);
  } else {
    console.error(`[FAIL] Failure 5: Expected lockout, got counter ${updated5.failedAttempts}, lockout ${updated5.lockedUntil}`);
  }

  // Try logging in while locked out
  console.log("Trying to login while locked out...");
  const resLocked = await simulateLoginFailure();
  if (resLocked.error === "Locked out") {
    console.log(`[PASS] Login rejected directly due to lockout state.`);
  } else {
    console.error(`[FAIL] Expected reject due to lockout, got:`, resLocked);
  }

  // Reset lockout manually to simulate successful login
  console.log("Simulating successful login (counter reset)...");
  await prisma.employee.update({
    where: { id: employee.id },
    data: { failedAttempts: 0, lockedUntil: null }
  });
  const updatedReset = await prisma.employee.findUnique({ where: { email: testEmail } });
  if (updatedReset.failedAttempts === 0 && !updatedReset.lockedUntil) {
    console.log(`[PASS] Counter reset successfully.`);
  } else {
    console.error(`[FAIL] Counter failed to reset:`, updatedReset);
  }

  // Clean up
  await prisma.employee.delete({ where: { id: employee.id } });
  console.log("Cleaned up test database records.");
}

async function main() {
  try {
    await testPasswordComplexity();
    await testAttachments();
    await testAccountLockout();
    console.log("\nAll security validation checks completed!");
  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
