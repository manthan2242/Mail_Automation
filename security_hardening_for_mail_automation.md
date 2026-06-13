# Security Hardening Roadmap - Mail Automation System

This document outlines the concrete updates and changes needed in your codebase to make the application completely secure against modern web application threats.

---

## 1. Authentication & 2FA Enforcement

### Fix 2FA Bypass in Middleware
Currently, users can skip 2FA by directly navigating to dashboard paths using the pre-2FA token.
- **File**: [middleware.ts](file:///c:/Projects/Mail-automation/middleware.ts)
- **Update Required**: Check for `payload.is2FAVerified` in the token middleware. If it is `false` (and the user is not requesting the OTP page), redirect the request to `/auth/verify-otp` (or return HTTP `401` for API requests).
- **Code Change**:
  ```typescript
  const isOtpRoute = pathname.startsWith('/auth/verify-otp') || 
                      pathname.startsWith('/api/auth/verify-otp') || 
                      pathname.startsWith('/api/auth/send-otp') || 
                      pathname.startsWith('/api/auth/logout');

  if (payload && !payload.is2FAVerified && !isOtpRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '2FA verification required' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/verify-otp', request.url));
  }
  ```

### Use Cryptographically Secure OTPs
- **Files**:
  - [app/api/auth/login/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/login/route.ts)
  - [app/api/auth/forgot-password/request/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/forgot-password/request/route.ts)
- **Update Required**: Replace pseudo-random `Math.random()` with `crypto.randomInt` to prevent predictability of OTP codes.
- **Code Change**:
  ```typescript
  import crypto from 'crypto';
  const code = crypto.randomInt(100000, 999999).toString();
  ```

---

## 2. Brute-Force & Lockout Implementation

### Account Lockout Controls
- **Files**:
  - [app/api/auth/login/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/login/route.ts)
  - [app/api/auth/verify-otp/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/verify-otp/route.ts)
- **Update Required**:
  1. Before allowing authentication checks, verify that `user.lockedUntil` is not in the future. If locked, block the request immediately.
  2. Increment `failedAttempts` on password failures and OTP failures.
  3. If `failedAttempts >= 5`, update the database to set `lockedUntil` to `now + 15 minutes`.
  4. Reset `failedAttempts` to `0` and clear `lockedUntil` on successful verification.

---

## 3. UI XSS (Cross-Site Scripting) Prevention

### Sanitize Rendered Email HTML
- **Files**:
  - [app/admin/clients/\[id\]/emails/page.tsx](file:///c:/Projects/Mail-automation/app/admin/clients/%5Bid%5D/emails/page.tsx)
  - [app/employee/status/page.tsx](file:///c:/Projects/Mail-automation/app/employee/status/page.tsx)
- **Update Required**:
  1. Install `dompurify` and `@types/dompurify`.
  2. Pass the email body HTML through `DOMPurify.sanitize(email.body)` before rendering it inside `dangerouslySetInnerHTML`.

---

## 4. Input & Attachment Sanitization

### Validate Email Attachments
- **Files**:
  - [app/api/employee/emails/route.ts](file:///c:/Projects/Mail-automation/app/api/employee/emails/route.ts)
  - [app/api/employee/send-email/route.ts](file:///c:/Projects/Mail-automation/app/api/employee/send-email/route.ts)
- **Update Required**:
  - Implement file size checking on the server (e.g. max 5MB per attachment).
  - Add filename extension checking to reject executable files (`.exe`, `.scr`, `.bat`, `.sh`, `.vbs`, etc.) to prevent users from accidentally forwarding malware.

### Enforce Password Complexity Policies
- **Files**:
  - [app/api/auth/change-password/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/change-password/route.ts)
  - [app/api/auth/forgot-password/reset/route.ts](file:///c:/Projects/Mail-automation/app/api/auth/forgot-password/reset/route.ts)
- **Update Required**: Validate that new passwords conform to secure standards: at least 8 characters, with at least one uppercase letter, one lowercase letter, one digit, and one special character.

---

## 5. Middleware & API Response Standards

### Return Proper HTTP Statuses in Middleware
- **File**: [middleware.ts](file:///c:/Projects/Mail-automation/middleware.ts)
- **Update Required**: Change HTTP `307 Redirect` to HTTP `403 Forbidden` JSON responses when an unauthorized user attempts to access `/api/admin` or `/api/employee` endpoints.

### Defense-in-Depth Route Validation
- **Files**: Route files under `app/api/admin/` and `app/api/employee/`
- **Update Required**: Validate the JWT role inside each endpoint's request handler in addition to relying on middleware router guards.
