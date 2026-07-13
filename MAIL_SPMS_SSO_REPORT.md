# Mail Automation SPMS SSO Integration Report

This report outlines the implementation details, database changes, test flow, and environment variables for the SPMS Single Sign-On (SSO) and User Synchronization API integration.

## 1. Implementation Details

Mail Automation remains a standalone application. The existing local credential login flow is fully intact and continues to work normally. SPMS SSO is integrated as an additional authentication mechanism.

### Key Components

1. **SSO Login Endpoint (`GET /sso/login?token=`)**
   - **Verification**: Verifies the signature of the incoming JWT using `SPMS_SSO_SECRET`. Validates that the issuer is `"SPMS"`. Verifies that the token was issued within the last 60 seconds (lifetime check on `iat`).
   - **User Matching**: normalizes and matches the user's email against `Admin` and `Employee` tables.
     - If the user exists: logs the user in. If their role has changed, they are moved to the correct table.
     - If the user does not exist: auto-creates them in the matching table.
   - **Role Mapping**:
     - `MAIL_ADMIN` -> `admin` (creates or logs in as an `Admin` record).
     - `MAIL_EMPLOYEE` -> `employee` (creates or logs in as an `Employee` record).
   - **Coexistence**: Since `Admin` and `Employee` tables require passwords in the schema, auto-created SSO users are initialized with a secure, random bcrypt-hashed password so they cannot be logged in locally without an admin resetting their password.
   - **Session Creation**: Generates a standard Mail Automation session JWT (using the native `signToken` utility) and stores it in the client's `token` HTTP-only cookie.
   - **Redirection**: Redirects the user to the central `/dashboard` routing gateway.

2. **Dashboard Router (`GET /dashboard`)**
   - Read the session token from cookies, validates it, and dynamically redirects the user to their role-specific workspace:
     - `admin` -> `/admin/dashboard`
     - `employee` -> `/employee/dashboard`
   - Unauthenticated or invalid token requests are redirected to `/auth/login`.

3. **Internal User Sync API (`POST /api/internal/users/sync`)**
   - A protected endpoint for SPMS to push account updates.
   - **Security**: Validates that request headers contain `INTERNAL_API_SECRET` (checked against `Authorization: Bearer <secret>`, `x-internal-secret`, or `x-api-key`).
   - **Logic**:
     - Updates existing users or creates new ones.
     - Performs automatic role transitions (moves the record between `Admin` and `Employee` tables if their role has changed).
     - Handles account deactivation: if `status` is `'inactive'` or `'disabled'`, locks the user by setting a far-future `lockedUntil` timestamp.

---

## 2. Database Changes

The Prisma schema (`prisma/schema.prisma`) was updated to include tracking columns on models representing actual users: `User`, `Admin`, and `Employee`.

### Modified Schema Fields

```prisma
// Added to Admin, Employee, and User models
authProvider     String    @default("LOCAL")
externalProvider String?
lastSSOLogin     DateTime?
```

### Applied Migration (`prisma/migrations/20260713103400_add_sso_fields/migration.sql`)

```sql
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);
```

The changes were applied directly to the PostgreSQL database using `prisma db push` and generated Prisma Client code.

---

## 3. Environment Variables

The following variables have been added to `.env` and `.env.example`:

```env
# SSO Configuration
SPMS_SSO_SECRET="spms-sso-jwt-signature-secret-key-32chars"
INTERNAL_API_SECRET="internal-api-secret-key-for-user-sync-32chars"
```

*Note: In production environments, these secrets must be replaced with strong, cryptographically secure keys.*

---

## 4. Test Flow & Verification

A test script `scratch/test_sso.js` was created to perform 8 key integration and security tests against the live endpoint.

### Execution Command
```bash
node scratch/test_sso.js
```

### Test Results Summary

1. **Valid Admin SSO Token Redirect**:
   - JWT generated from SPMS containing `MAIL_ADMIN` claims.
   - Sent GET to `/sso/login?token=<JWT>`.
   - Result: **HTTP 307 Redirect** to `/dashboard` with `token` cookie set. **SUCCESS**
2. **Expired SSO Token**:
   - JWT generated with `iat` set to 70 seconds ago.
   - Sent GET to `/sso/login?token=<JWT>`.
   - Result: **HTTP 307 Redirect** to `/auth/login?error=SSO+token+has+expired`. **SUCCESS**
3. **Invalid Issuer**:
   - JWT signed with issuer `'OTHER_PROVIDER'`.
   - Result: **HTTP 307 Redirect** to `/auth/login?error=Invalid+SSO+token+issuer`. **SUCCESS**
4. **Invalid Signature**:
   - JWT signed with incorrect secret.
   - Result: **HTTP 307 Redirect** to `/auth/login?error=Invalid+SSO+token+signature`. **SUCCESS**
5. **User Sync API (Create Admin)**:
   - Sent POST to `/api/internal/users/sync` with role `MAIL_ADMIN` and status `active`. Authorized with `Authorization: Bearer <secret>`.
   - Result: **HTTP 200 OK** returning success and user object. **SUCCESS**
6. **User Sync API (Create Employee)**:
   - Sent POST to `/api/internal/users/sync` with role `MAIL_EMPLOYEE` and status `active`. Authorized with `x-internal-secret`.
   - Result: **HTTP 200 OK** returning success and user object. **SUCCESS**
7. **User Sync API (Deactivate User)**:
   - Sent POST to `/api/internal/users/sync` with status `inactive`. Authorized with `x-api-key`.
   - Result: **HTTP 200 OK** returning user object with `locked: true`. **SUCCESS**
8. **User Sync API (Unauthorized Block)**:
   - Sent POST to `/api/internal/users/sync` with incorrect credentials.
   - Result: **HTTP 401 Unauthorized**. **SUCCESS**
