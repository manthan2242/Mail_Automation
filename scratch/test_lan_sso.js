const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const APP_URL = 'http://localhost:3005';
const SSO_SECRET = process.env.MAIL_SSO_SECRET || process.env.SPMS_SSO_SECRET;
const SYNC_SECRET = process.env.MAIL_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET;

console.log('--- LAN TEST CONFIGURATION ---');
console.log('Target URL:', APP_URL);
console.log('SSO Secret (using MAIL_SSO_SECRET alias):', SSO_SECRET);
console.log('Sync Secret (using MAIL_INTERNAL_SECRET alias):', SYNC_SECRET);
console.log('------------------------------\n');

// Helper to sign token
function generateSSOToken(payload, secret = SSO_SECRET) {
  return jwt.sign(
    {
      iss: 'SPMS',
      iat: Math.floor(Date.now() / 1000),
      ...payload
    },
    secret,
    { algorithm: 'HS256' }
  );
}

async function runTests() {
  try {
    console.log('1. Simulating SSO Redirect GET from http://192.168.1.9...');
    const adminToken = generateSSOToken({
      email: 'lan_admin_test@example.com',
      name: 'LAN Admin User',
      role: 'MAIL_ADMIN',
      company_id: 'company_999',
      issuer: 'SPMS'
    });

    const ssoUrl = `${APP_URL}/sso/login?token=${adminToken}`;
    const ssoRes = await axios.get(ssoUrl, {
      headers: {
        'Origin': 'http://192.168.1.9'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    console.log('Status:', ssoRes.status);
    console.log('Access-Control-Allow-Origin:', ssoRes.headers['access-control-allow-origin']);
    console.log('Access-Control-Allow-Credentials:', ssoRes.headers['access-control-allow-credentials']);
    
    if (ssoRes.headers['access-control-allow-origin'] === 'http://192.168.1.9') {
      console.log('✅ CORS Origin header correctly reflected in GET response');
    } else {
      console.log('❌ CORS Origin header mismatch in GET response:', ssoRes.headers['access-control-allow-origin']);
    }

    console.log('\n2. Testing OPTIONS Preflight request to /sso/login...');
    const optRes1 = await axios.options(`${APP_URL}/sso/login`, {
      headers: {
        'Origin': 'http://192.168.1.9:3000',
        'Access-Control-Request-Method': 'GET'
      },
      validateStatus: () => true
    });
    console.log('OPTIONS status:', optRes1.status);
    console.log('CORS headers:', {
      origin: optRes1.headers['access-control-allow-origin'],
      methods: optRes1.headers['access-control-allow-methods'],
      credentials: optRes1.headers['access-control-allow-credentials']
    });
    if (optRes1.status === 200 && optRes1.headers['access-control-allow-origin'] === 'http://192.168.1.9:3000') {
      console.log('✅ OPTIONS preflight to /sso/login SUCCESS');
    } else {
      console.log('❌ OPTIONS preflight to /sso/login FAILED');
    }

    console.log('\n3. Testing OPTIONS Preflight request to /api/internal/users/sync...');
    const optRes2 = await axios.options(`${APP_URL}/api/internal/users/sync`, {
      headers: {
        'Origin': 'http://192.168.1.9:8000',
        'Access-Control-Request-Method': 'POST'
      },
      validateStatus: () => true
    });
    console.log('OPTIONS status:', optRes2.status);
    console.log('CORS headers:', {
      origin: optRes2.headers['access-control-allow-origin'],
      headers: optRes2.headers['access-control-allow-headers']
    });
    if (optRes2.status === 200 && optRes2.headers['access-control-allow-origin'] === 'http://192.168.1.9:8000') {
      console.log('✅ OPTIONS preflight to user sync API SUCCESS');
    } else {
      console.log('❌ OPTIONS preflight to user sync API FAILED');
    }

    console.log('\n4. Syncing Intern User (Role Mapping)...');
    const syncInternRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'intern_test@example.com',
        name: 'LAN Intern Test',
        role: 'MAIL_INTERN',
        status: 'active'
      },
      {
        headers: {
          'Origin': 'http://192.168.1.9:8000',
          'Authorization': `Bearer ${SYNC_SECRET}`
        },
        validateStatus: () => true
      }
    );
    console.log('Sync Intern Status:', syncInternRes.status);
    console.log('Mapped Role (should be employee):', syncInternRes.data?.user?.role);
    if (syncInternRes.status === 200 && syncInternRes.data?.user?.role === 'employee') {
      console.log('✅ Intern Role Mapping SUCCESS');
    } else {
      console.log('❌ Intern Role Mapping FAILED');
    }

    console.log('\n5. Syncing Consultant User (Role Mapping)...');
    const syncConsultantRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'consultant_test@example.com',
        name: 'LAN Consultant Test',
        role: 'MAIL_CONSULTANT',
        status: 'active'
      },
      {
        headers: {
          'Origin': 'http://192.168.1.9:8000',
          'Authorization': `Bearer ${SYNC_SECRET}`
        },
        validateStatus: () => true
      }
    );
    console.log('Sync Consultant Status:', syncConsultantRes.status);
    console.log('Mapped Role (should be employee):', syncConsultantRes.data?.user?.role);
    if (syncConsultantRes.status === 200 && syncConsultantRes.data?.user?.role === 'employee') {
      console.log('✅ Consultant Role Mapping SUCCESS');
    } else {
      console.log('❌ Consultant Role Mapping FAILED');
    }

    console.log('\n6. Syncing Inactive User (Locking)...');
    const lockRes = await axios.post(
      `${APP_URL}/api/internal/users/sync`,
      {
        email: 'intern_test@example.com',
        name: 'LAN Intern Test',
        role: 'MAIL_INTERN',
        status: 'inactive'
      },
      {
        headers: {
          'Origin': 'http://192.168.1.9:8000',
          'Authorization': `Bearer ${SYNC_SECRET}`
        },
        validateStatus: () => true
      }
    );
    console.log('Deactivate status:', lockRes.status);
    console.log('Locked Flag:', lockRes.data?.user?.locked);
    if (lockRes.status === 200 && lockRes.data?.user?.locked === true) {
      console.log('✅ Inactive User Locking SUCCESS');
    } else {
      console.log('❌ Inactive User Locking FAILED');
    }

    console.log('\n7. Verify GET /sso/login role mapping for Intern (should be employee)...');
    const internSSOToken = generateSSOToken({
      email: 'intern_sso_test@example.com',
      name: 'SSO Intern',
      role: 'MAIL_INTERN',
      company_id: 'company_999',
      issuer: 'SPMS'
    });
    const ssoInternRes = await axios.get(`${APP_URL}/sso/login?token=${internSSOToken}`, {
      headers: { 'Origin': 'http://192.168.1.9' },
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log('GET /sso/login (Intern) status:', ssoInternRes.status);
    console.log('Cookies Set:', ssoInternRes.headers['set-cookie'] ? 'Yes' : 'No');
    if (ssoInternRes.status === 307) {
      console.log('✅ Intern SSO auto-provisioning and session redirect SUCCESS');
    } else {
      console.log('❌ Intern SSO FAILED');
    }

    console.log('\nAll LAN integration tests run completed.');
  } catch (err) {
    console.error('Test script runtime error:', err.message);
  }
}

runTests();
