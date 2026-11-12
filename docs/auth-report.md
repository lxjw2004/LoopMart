# Auth verification

Real PostgreSQL integration passed on 2026-11-12:

`node --env-file=.env.test --import tsx --test tests/auth.integration.test.ts`

Result: 2 passed, 0 failed, 0 skipped. Covers signup, unverified login denial, email verification, login, banned login denial, disallowed domain rejection (durable database absence), verified email change, password reset, old password rejection, old session revocation, logout, and uniform blank SMTP reset failure.

Better Auth intentionally returns generic HTTP 200 for registration rejected by a 403 database hook when verification is required; test checks no account was created. Test-only email delivery is a function argument to createAuth, never an environment bypass or public endpoint.

Production requires SMTP_URL and MAIL_FROM together. Blank SMTP blocks signup/reset/change-email before account lookup. TRUSTED_ORIGINS accepts explicit HTTPS origins and local HTTP origins only. Domain registration policy is read from settings.data on every signup/change-email.

Migration: build then `npm run auth:migrate`; business settings migration must also run before auth requests. No email delivery to external SMTP was tested. Managed provisioning is encapsulated in apps/auth/src/admin.ts using the pinned Better Auth internal adapter on the caller’s transaction connection. Integration verifies audit failure rolls provisioning back, managed password hashing, and session revocation. Email subjects include Chinese and English.
