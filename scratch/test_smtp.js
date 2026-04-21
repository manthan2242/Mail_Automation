const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  console.log("--- SMTP Diagnostic Tool ---");
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  console.log(`Checking credentials for: ${user}`);
  
  if (!user || user.includes("example.com")) {
    console.error("\n❌ ERROR: You are still using the placeholder 'your-email@example.com'.");
    console.error("Please update EMAIL_USER and EMAIL_PASS in your .env file with your actual Gmail account and App Password.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("✅ SUCCESS: Connected to Gmail SMTP server!");

    console.log(`Attempting to send test email to ${user}...`);
    const info = await transporter.sendMail({
      from: user,
      to: user,
      subject: "SMTP Diagnostic Test",
      text: "If you received this, your SMTP settings are correct!"
    });
    console.log("✅ SUCCESS: Test email sent!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("\n❌ SMTP CONNECTION FAILED:");
    console.error(error.message);
    
    if (error.code === 'EAUTH') {
      console.log("\n💡 TIP: If using Gmail, you MUST use an 'App Password' (16 characters), not your regular account password.");
      console.log("Go to: https://myaccount.google.com/apppasswords");
    }
  }
}

testSMTP();
