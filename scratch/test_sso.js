const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const APP_URL = 'http://localhost:3004';
const SSO_SECRET = process.env.SPMS_SSO_SECRET || 'spms-sso-jwt-signature-secret-key-32chars';
const SYNC_SECRET = process.env.INTERNAL_API_SECRET || 'internal-api-secret-key-for-user-sync-32chars';

console.log('--- TEST CONFIGURATION ---');
console.log('App URL:', APP_URL);
console.log('SSO Secret:', SSO_SECRET);
console.log('Sync Secret:', SYNC_SECRET);
console.log('--------------------------\n');

// Helper to sign token
function generateSSOToken(payload, secret = SSO_SECRET, expiresIn = '60s') {
  return jwt.sign(
    {
      iss: 'SPMS',
      iat: Math.floor(Date.now() / 1000),
      ...payload
    },
    secret,
    { algorithm: 'HS256', expiresIn }
  );
}

async function runTests() {
  try {
    console.log('1. Testing Valid Admin SSO Token Redirect...');
    const adminToken = generateSSOToken({
      email: 'sso_admin_test@example.com',
      name: 'SSO Admin Test',
      role: 'MAIL_ADMIN',
      company_id: 'company_123',
      issuer: 'SPMS'
    });

    console.log('Generated Valid Admin JWT:', adminToken);
    const loginUrl = `${APP_URL}/sso/login?token=${adminToken}`;
    console.log('Login Link: ', loginUrl);

    // We expect a redirect to /dashboard (307 Temporary Redirect)
    try {
      const loginRes = await axios.get(loginUrl, { maxRedirects: 0, validateStatus: () => true });
      console.log('GET /sso/login response status:', loginRes.status);
      console.log('Redirect Location:', loginRes.headers.location);
      console.log('Cookies Set:', loginRes.headers['set-cookie']);
      if (loginRes.headers.location && loginRes.headers.location.includes('/dashboard')) {
        console.log('✅ SSO Login Redirect to /dashboard SUCCESS');
      } else {
        console.log('❌ SSO Login Redirect failed. Check redirect location:', loginRes.headers.location);
      }
    } catch (e) {
      console.error('SSO login fetch error:', e.message);
    }

    console.log('\n2. Testing Expired SSO Token (iat > 60s ago)...');
    const expiredToken = jwt.sign(
      {
        iss: 'SPMS',
        iat: Math.floor(Date.now() / 1000) - 70, // 70 seconds ago
        email: 'sso_admin_test@example.com',
        name: 'SSO Admin Test',
        role: 'MAIL_ADMIN',
        company_id: 'company_123',
        issuer: 'SPMS'
      },
      SSO_SECRET,
      { algorithm: 'HS256' }
    );
    const expiredUrl = `${APP_URL}/sso/login?token=${expiredToken}`;
    const expiredRes = await axios.get(expiredUrl, { maxRedirects: 0, validateStatus: () => true });
    console.log('GET /sso/login (expired) status:', expiredRes.status);
    console.log('Redirect Location (expected error page):', expiredRes.headers.location);
    if (expiredRes.headers.location && expiredRes.headers.location.includes('error=SSO+token+has+expired')) {
      console.log('✅ Expired token rejection SUCCESS');
    } else {
      console.log('❌ Expired token rejection failed');
    }

    console.log('\n3. Testing Invalid Issuer...');
    const invalidIssuerToken = generateSSOToken({
      iss: 'OTHER_PROVIDER',
      email: 'sso_admin_test@example.com',
      role: 'MAIL_ADMIN',
      issuer: 'OTHER_PROVIDER'
    });
    const invalidIssuerUrl = `${APP_URL}/sso/login?token=${invalidIssuerToken}`;
    const invalidIssuerRes = await axios.get(invalidIssuerUrl, { maxRedirects: 0, validateStatus: () => true });
    console.log('GET /sso/login (invalid issuer) status:', invalidIssuerRes.status);
    console.log('Redirect Location:', invalidIssuerRes.headers.location);
    if (invalidIssuerRes.headers.location && invalidIssuerRes.headers.location.includes('error=Invalid+SSO+token+issuer')) {
      console.log('✅ Invalid issuer rejection SUCCESS');
    } else {
      console.log('❌ Invalid issuer rejection failed');
    }

    console.log('\n4. Testing Unsigned/Invalid Signature...');
    const badSignatureToken = generateSSOToken(
      {
        email: 'sso_admin_test@example.com',
        role: 'MAIL_ADMIN'
      },
      'WRONG_SECRET'
    );
    const badSigUrl = `${APP_URL}/sso/login?token=${badSignatureToken}`;
    const badSigRes = await axios.get(badSigUrl, { maxRedirects: 0, validateStatus: () => true });
    console.log('GET /sso/login (bad signature) status:', badSigRes.status);
    console.log('Redirect Location:', badSigRes.headers.location);
    if (badSigRes.headers.location && badSigRes.headers.location.includes('error=Invalid+SSO+token+signature')) {
      console.log('✅ Invalid signature rejection SUCCESS');
    } else {
      console.log('❌ Invalid signature rejection failed');
    }

    console.log('\n5. Testing User Sync API: Create/Update Admin...');
    const syncAdminRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'sync_admin_test@example.com',
        name: 'Sync Admin Test',
        role: 'MAIL_ADMIN',
        status: 'active'
      },
      {
        headers: {
          'Authorization': `Bearer ${SYNC_SECRET}`
        },
        validateStatus: () => true
      }
    );
    console.log('POST /api/internal/users/sync (Admin) status:', syncAdminRes.status);
    console.log('Response body:', syncAdminRes.data);
    if (syncAdminRes.status === 200 && syncAdminRes.data.success) {
      console.log('✅ Sync Admin SUCCESS');
    } else {
      console.log('❌ Sync Admin FAILED');
    }

    console.log('\n6. Testing User Sync API: Create/Update Employee...');
    const syncEmpRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'sync_emp_test@example.com',
        name: 'Sync Employee Test',
        role: 'MAIL_EMPLOYEE',
        status: 'active'
      },
      {
        headers: {
          'x-internal-secret': SYNC_SECRET
        },
        validateStatus: () => true
      }
    );
    console.log('POST /api/internal/users/sync (Employee) status:', syncEmpRes.status);
    console.log('Response body:', syncEmpRes.data);
    if (syncEmpRes.status === 200 && syncEmpRes.data.success) {
      console.log('✅ Sync Employee SUCCESS');
    } else {
      console.log('❌ Sync Employee FAILED');
    }

    console.log('\n7. Testing User Sync API: Deactivate User...');
    const deactivateRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'sync_emp_test@example.com',
        name: 'Sync Employee Test',
        role: 'MAIL_EMPLOYEE',
        status: 'inactive'
      },
      {
        headers: {
          'x-api-key': SYNC_SECRET
        },
        validateStatus: () => true
      }
    );
    console.log('POST /api/internal/users/sync (Deactivate) status:', deactivateRes.status);
    console.log('Response body:', deactivateRes.data);
    if (deactivateRes.status === 200 && deactivateRes.data.user.locked) {
      console.log('✅ User Deactivation SUCCESS');
    } else {
      console.log('❌ User Deactivation FAILED');
    }

    console.log('\n8. Testing User Sync API: Unauthorized access...');
    const unauthorizedRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'sync_emp_test@example.com',
        name: 'Sync Employee Test',
        role: 'MAIL_EMPLOYEE',
        status: 'active'
      },
      {
        headers: {
          'Authorization': 'Bearer WRONG_SECRET'
        },
        validateStatus: () => true
      }
    );
    console.log('POST /api/internal/users/sync (unauthorized) status:', unauthorizedRes.status);
    if (unauthorizedRes.status === 401) {
      console.log('✅ Unauthorized block SUCCESS');
    } else {
      console.log('❌ Unauthorized block FAILED');
    }

    console.log('\nAll tests run completed.');
  } catch (error) {
    console.error('Test execution error:', error.message);
  }
}

runTests();
