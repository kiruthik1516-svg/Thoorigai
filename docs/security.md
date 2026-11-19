# Security model

## Assets and actors

- Assets: student identity/contact data, fees and GST invoices, certificates and verification codes, course materials, staff identities, credentials, audit records, and service credentials.
- Actors: unauthenticated visitors, authenticated staff, administrators, compromised accounts, and automated scanners. Roles are `admin`, `staff` and `pending`; the old `trainer` role was consolidated into `staff`.
- Trust boundaries: browser to Next.js Proxy/routes; Next.js server to Supabase Auth/Postgres/Storage; public verification to the narrowly scoped `public_verify_document` RPC; CI to package registries and GitHub Actions.

## Main risks and controls

| Risk                                                  | Control                                                                                                                                                                                                                                              | Status                                                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen/expired session or stale role                  | Supabase `getClaims` refresh in `proxy.ts`; each `withApi` request loads the current profile role; admin sessions must sign in again after 12 hours (`lib/auth/session-age.ts`, checked in the proxy)                                                | Implemented                                                                                                                                        |
| Session token theft through script injection          | Strict nonce-based CSP (`proxy.ts`); no inline scripts or styles without the request nonce                                                                                                                                                           | The Supabase auth cookie is readable by page scripts (needed by the browser client); the CSP and the 12-hour admin session limit reduce the impact |
| Forged cross-site mutation                            | Origin + Host comparison and content-type checks in `withApi`; allowed origins come from `NEXT_PUBLIC_APP_URL` and `ALLOWED_ORIGINS`                                                                                                                 | Applied to all mutation routes                                                                                                                     |
| Admin account takeover                                | Strong password rules, login rate limits, 12-hour admin sessions, disabled accounts are banned in Supabase Auth                                                                                                                                      | **MFA is not implemented.** Admin accounts are password-only                                                                                       |
| Verification-code enumeration                         | Strict IP rate limit; public RPC does exact matches only and returns minimal data; invalid, missing, orphaned and revoked results share one invalid object; no-store/noindex                                                                         | Implemented                                                                                                                                        |
| Malicious material upload                             | MIME/extension/signature validation, a 4 MB cap (Vercel function body limit), random object keys and five-minute signed URLs; RLS limits metadata and objects to assigned courses                                                                    | Implemented                                                                                                                                        |
| Secret or PII exposure                                | Server-only service client; structured logger redaction (login logs a request id, never the email); Sentry PII disabled with request/exception scrubbing; `/api/health` does not publish the commit                                                  | See "Service-role access" for every caller                                                                                                         |
| Supply-chain compromise                               | Frozen lockfile, production dependency audit in CI on every push to `main`, pinned CI actions, Dependabot (npm and GitHub Actions), gitleaks and a staged-content secret hook                                                                        | Implemented                                                                                                                                        |
| Unauthorized self-registration / privilege escalation | `/signup` exists for invite-based onboarding, but every new account is created as `pending` (no privileges); an invite code is redeemed only by the server (`redeem_invite_code`, service role); role changes go through `admin_change_profile_role` | Enforced in the signup route, database trigger, RLS policies and `/api/admin/users`                                                                |

## Service-role access

The service-role key is read only in server-only `lib/supabase/admin.ts`. The ESLint rule in `eslint.config.mjs` blocks it everywhere else (including dynamic `import()`). Reviewed callers:

1. `app/api/course-materials/route.ts`: mints five-minute signed URLs for private storage objects after RLS has filtered the metadata.
2. `app/api/invoices/[invoice]/download/route.ts`: reads and writes the private invoice PDF cache.
3. `app/api/ready/route.ts`: checks the migration marker and private buckets, then returns only a generic readiness status.
4. `app/api/admin/users/route.ts`: creates, invites, bans and re-enables users through the Supabase Admin API for an authenticated administrator.
5. `app/api/auth/login`, `signup`, `verify-invite`, `redeem-invite`: profile lookup at login, pending-account creation, invite checks and the atomic invite redemption RPC.
6. `modules/courses/service.ts`, `modules/gst/service.ts`: cached reads inside `unstable_cache` (no request cookies); callers check permissions first.
7. `modules/notifications/service.ts`: notifications are written only by server code.

The public verification handler calls a fixed-shape RPC with the publishable key and has no service-role fallback.

## User registration and role lifecycle

`supabase/config.toml` keeps `enable_signup = true` because the invite flow (`/signup`, `POST /api/auth/signup`) creates accounts. Every new account starts as `pending`.

- The database trigger `public.handle_new_user()` defaults new profiles to `role = 'pending'` and ignores client-supplied `raw_user_meta_data` for role assignment.
- The `pending` role has no privileges: no RLS policy lets `pending` users read or change students, payments, courses, certificates, attendance, assessments or materials.
- `withApi` and `getCurrentProfile` reject `pending` users.
- Role changes (for example approving a `pending` user as `staff`) go through `admin_change_profile_role`, which takes an advisory lock and keeps at least one admin.
- Accounts are disabled, never deleted (`admin_set_user_disabled`), so the audit log keeps who did what. Disabled accounts hold `pending` and are banned in Supabase Auth.
- Staff only reach students, attendance, assessments, materials and certificates for courses they are assigned to (Settings > Trainers).

## Rate limiting configuration

Upstash Redis sliding-window limits are used for public verification (10/minute/IP), password login (5/15 minutes/IP), signup and invite redemption (5/15 minutes/IP), invite verification (30/minute/IP), certificate creation (10/15 minutes/user), payment mutations (20/minute/user), uploads (10/minute/user), invite creation and user administration (10-20/minute/user), and every other authenticated mutation (60/minute/user by default in `withApi`). Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production. Without them, production falls back to a per-instance in-memory limiter and logs `rate_limit_degraded`; this is weaker than Redis because each server instance counts separately. Set `RATE_LIMIT_REQUIRE_REDIS=true` once Redis is configured to fail closed with 503 instead. The server refuses to start if these variables are inconsistent (`lib/env.server.ts`). Local development bypasses the limiter.

## Data retention and deletion

Collect only fields needed to administer training and statutory accounting. Restrict access by role and retain personal data only for the operational and legal period approved by the organization. When retention ends, delete or irreversibly anonymize personal data, including exports and backups according to their lifecycle. Financial invoices and statutory accounting records may require a different retention schedule from student contact/profile data. These timelines and the handling of access/deletion requests must be reviewed by Indian privacy counsel for the Digital Personal Data Protection Act, 2023 and applicable rules before production use; this document is not legal advice.

## Deployment gates / outstanding evidence

Before production: run all database migrations and pgTAP tests on a clean local Supabase instance; test real JWTs for each role on every route/table; run CSP tests over print/PDF and QR flows; run `node scripts/check-security-headers.mjs <deployed-origin>` and `pnpm audit --prod`; review the security contact and retention periods with the organization/legal counsel. The committed Gitleaks baseline is intentionally empty: no known findings are waived. Known residual risks: no MFA (see above); the `picomatch` advisory GHSA-fc5q-39xc-vjpf has no fix and is ignored in CI for that one ID only (build-time dependency of `@sentry/nextjs`).
