const jwt = require('jsonwebtoken');
require('dotenv').config();

const IP = '192.168.1.6';
const PORT = '3004';
const SECRET = process.env.SPMS_SSO_SECRET || 'spms-sso-jwt-signature-secret-key-32chars';

const payload = {
  iss: 'SPMS',
  iat: Math.floor(Date.now() / 1000),
  email: 'sso_admin_test@example.com',
  name: 'SSO Admin Test',
  role: 'MAIL_ADMIN',
  company_id: 'company_123',
  issuer: 'SPMS'
};

const token = jwt.sign(payload, SECRET);
console.log('\nCopy and paste this URL into the other system using the same Wi-Fi:');
console.log(`http://${IP}:${PORT}/sso/login?token=${token}\n`);
console.log('Note: Because of security rules, this URL is only valid for 60 seconds from generation.');
