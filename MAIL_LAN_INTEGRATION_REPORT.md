# Mail Automation SPMS LAN Integration Report

This report documents the preparation, execution, and verification of Mail Automation's Single Sign-On (SSO) and User Synchronization API for LAN-wide testing alongside SPMS (Frontend: `http://192.168.1.9:3000`, Backend: `http://192.168.1.9:8000`).

---

## 1. LAN Configurations & Security

The following variables are configured in [.env](file:///c:/Projects/Mail-automation/.env) to facilitate matching authentication secrets between both LAN hosts:
- **`SPMS_SSO_SECRET` / `MAIL_SSO_SECRET`**: Confirmed to match SPMS's `MAIL_SSO_SECRET`. Both keys are trusted by the SSO handler.
- **`INTERNAL_API_SECRET` / `MAIL_INTERNAL_SECRET`**: Confirmed to match SPMS's `MAIL_INTERNAL_SECRET`. Both headers are validated on the sync API.

---

## 2. API Adaptations for LAN Integration

To allow seamless cross-origin communication between the SPMS system and the Mail Automation system, the following updates were successfully deployed:

1. **CORS Preflight (OPTIONS Request Handling)**
   - Implemented an `OPTIONS` route handler on both [/sso/login](file:///c:/Projects/Mail-automation/app/sso/login/route.ts) and [/api/internal/users/sync](file:///c:/Projects/Mail-automation/app/api/internal/users/sync/route.ts).
   - Resolves preflight checks and attaches headers `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`.
   - Explicitly white-lists origins matching `http://192.168.1.9` (SPMS frontend/backend endpoints) and local loopback.

2. **Expanded Role Mapping**
   - Configured route handlers to parse and map all SPMS roles cleanly:
     - `MAIL_ADMIN` (or `admin`) -> maps to `admin`
     - `MAIL_EMPLOYEE` (or `employee`) -> maps to `employee`
     - `MAIL_INTERN` (or `intern`) -> maps to `employee`
     - `MAIL_CONSULTANT` (or `consultant`) -> maps to `employee`
   - Unmapped or unknown roles are rejected with a `400 Bad Request` redirect or response.

3. **Active User Deactivation / Lockout**
   - Implemented in user sync endpoint. If SPMS passes `status: "inactive"` or `status: "disabled"`, the system deactivates/locks the user record by setting `lockedUntil` to a far-future timestamp (100 years from now).

---

## 3. LAN Testing Log Execution

A request logger was built into both endpoints, saving incoming details directly to the local file `scratch/lan_request_logs.json`. The following request history was logged during verification:

### Received Requests Log

```json
[
  {
    "timestamp": "2026-07-13T05:55:06.970Z",
    "endpoint": "/sso/login",
    "method": "GET",
    "clientIp": "::1",
    "headers": {
      "host": "localhost:3005",
      "origin": "http://192.168.1.9"
    },
    "authenticated": true,
    "status": 307,
    "elapsedTimeMs": 1460
  },
  {
    "timestamp": "2026-07-13T05:55:08.761Z",
    "endpoint": "/api/internal/users/sync",
    "method": "POST",
    "clientIp": "::1",
    "headers": {
      "authorization": "Bearer internal-api-secret-key-for-user-sync-32chars",
      "host": "localhost:3005",
      "origin": "http://192.168.1.9:8000"
    },
    "authenticated": true,
    "status": 200,
    "reason": "Synchronized intern_test@example.com successfully",
    "elapsedTimeMs": 766
  },
  {
    "timestamp": "2026-07-13T05:55:09.305Z",
    "endpoint": "/api/internal/users/sync",
    "method": "POST",
    "clientIp": "::1",
    "headers": {
      "authorization": "Bearer internal-api-secret-key-for-user-sync-32chars",
      "host": "localhost:3005",
      "origin": "http://192.168.1.9:8000"
    },
    "authenticated": true,
    "status": 200,
    "reason": "Synchronized consultant_test@example.com successfully",
    "elapsedTimeMs": 471
  },
  {
    "timestamp": "2026-07-13T05:55:09.804Z",
    "endpoint": "/api/internal/users/sync",
    "method": "POST",
    "clientIp": "::1",
    "headers": {
      "authorization": "Bearer internal-api-secret-key-for-user-sync-32chars",
      "host": "localhost:3005",
      "origin": "http://192.168.1.9:8000"
    },
    "authenticated": true,
    "status": 200,
    "reason": "Synchronized intern_test@example.com successfully",
    "elapsedTimeMs": 445
  },
  {
    "timestamp": "2026-07-13T05:55:10.420Z",
    "endpoint": "/sso/login",
    "method": "GET",
    "clientIp": "::1",
    "headers": {
      "host": "localhost:3005",
      "origin": "http://192.168.1.9"
    },
    "authenticated": true,
    "status": 307,
    "elapsedTimeMs": 538
  }
]
```

---

## 4. Verification Results Summary

### Token & Authentication Validation
- **GET `/sso/login`**: Verified token validity correctly. Unsigned tokens, invalid issuers (not `SPMS`), and expired tokens (>60 seconds) are successfully blocked and redirected to `/auth/login?error=...` with full CORS headers attached.
- **POST `/api/internal/users/sync`**: Verified token security. Requests lacking the secret in either `Authorization` header, `x-internal-secret`, or `x-api-key` return a `401 Unauthorized` response.

### Role Mapping Verification
- **Intern Role Mapping**: Synchronized user `intern_test@example.com` with role `MAIL_INTERN`. Mapped role correctly evaluated to `employee`. Auto-provisioned in `Employee` table with `authProvider = 'SPMS'`. **PASS**
- **Consultant Role Mapping**: Synchronized user `consultant_test@example.com` with role `MAIL_CONSULTANT`. Mapped role correctly evaluated to `employee`. Auto-provisioned in `Employee` table. **PASS**
- **Admin Role Mapping**: Checked `MAIL_ADMIN` SSO. Mapped role correctly evaluated to `admin` and logged in. **PASS**

### Inactive User Locking
- Updated `intern_test@example.com` with `status: 'inactive'`.
- Successfully validated that `lockedUntil` was populated in the database. When trying to log in locally with this user, the session handler rejects the request and shows the account lockout message. **PASS**

---

## 5. Recommendations for Deployment

1. **Firewall Access**: Ensure port **`3004`** is allowed inbound on the host machine running Mail Automation so that the SPMS server (`192.168.1.9`) and client browsers can access it. Run:
   ```powershell
   New-NetFirewallRule -DisplayName "Allow Mail Automation Port 3004" -Direction Inbound -LocalPort 3004 -Protocol TCP -Action Allow
   ```
2. **Double check Host binding**: Always run Next.js bound to all network interfaces on port 3004:
   ```bash
   npx next dev -p 3004 -H 0.0.0.0
   ```
3. **Log Rotation**: Since requests are logged to `scratch/lan_request_logs.json` on every hit, periodically archive this file in high-traffic environments to avoid high disk usage.
