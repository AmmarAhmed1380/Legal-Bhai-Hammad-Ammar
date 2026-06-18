# LegalBahi Test Report

Date: 2026-06-13

## Staging validation attempt - 2026-06-13 local shell date

| Command / check | Result | Notes |
| --- | --- | --- |
| Read `.env.example` | Pass | Template was present and reviewed. |
| Read `.env.production.example` | Blocked | File is not present in this repo; `.env.example` is the only tracked env template. |
| Read readiness/security reports | Pass | `DEPLOYMENT_READY.md`, `TEST_REPORT.md`, `SECURITY_NOTES.md`, and `PILOT_ACCEPTANCE_REPORT.md` were reviewed before validation. |
| Create `.env.staging` from provided secrets | Blocked | No staging env source path was provided, no `.env.staging` exists, no matching file was found by filename search, and required staging variables are not exported in the shell. No placeholder secret file was created. |
| `npm ci` | Pass | Installed 652 packages and reported 0 vulnerabilities during install. |
| `npx playwright install chromium` | Pass | Completed successfully. |
| `npm run lint` | Pass | Repository lint passed for 211 unignored files. |
| `npm run verify` | Pass local | Full local gate passed. API tests reported 60 tests: 59 pass, 1 skipped. The skipped test is the PostgreSQL integration test gated by `TEST_DATABASE_URL`. |
| `npm audit --omit=dev --json` | Pass | 0 production vulnerabilities. |
| PostgreSQL integration with `TEST_DATABASE_URL` | Blocked | `TEST_DATABASE_URL` is not set, so the PostgreSQL pilot runtime test still skips. |
| `npm run smoke:production` | Fail blocked | Failed before network activity because required staging/production env was absent: `JWT_SECRET`, `CORS_ORIGINS`, `DATABASE_URL`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `PILOT_ADMIN_SECRET`, Twilio, Resend, R2, Sentry, `IHC_SYNC_ENABLED`, and `TRUST_PROXY_LOOPBACK`. |
| Twilio staging OTP | Blocked | Missing Twilio env plus test lawyer/client phone setup. |
| Resend staging email | Blocked | Missing Resend env and test email setup. |
| Cloudflare R2 staging upload/download/delete | Blocked | Missing R2 account/key/bucket env. |
| Sentry staging event | Blocked | Missing `SENTRY_DSN`. |
| Mobile Android export | Pass build path | `EXPO_PUBLIC_API_URL=https://staging-api.example.invalid EXPO_PUBLIC_ENABLE_DEMO_SURFACES=false npm --workspace @wakeel/mobile exec expo export -- --platform android --output-dir /tmp/legalbahi-mobile-export` completed successfully. Actual staging API URL validation remains blocked because the staging env was not provided. |
| Full staging pilot smoke | Blocked | Requires staging API/web URLs, staging database, provider credentials, test staff/client numbers, and portal token or setup flow. |
| Live IHC source smoke | Blocked | Requires staging env and live IHC fetch enabled. |
| Live Rawalpindi District/lower court source smoke | Not supported live | Current source implementation is fixture-backed for Rawalpindi District/lower courts. |
| Live LHC Rawalpindi Bench source smoke | Not supported live | Current source implementation is fixture-backed for LHC Rawalpindi Bench. |

### Missing staging inputs

- Absolute path to the staging env file that should be copied to ignored `.env.staging`.
- `TEST_DATABASE_URL`.
- Staging `DATABASE_URL`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `EXPO_PUBLIC_API_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PILOT_ADMIN_SECRET`, `TRUST_PROXY_LOOPBACK=true`, `IHC_SYNC_ENABLED=true`, and `IHC_SYNC_INTERVAL_MINUTES`.
- Twilio, Resend, Cloudflare R2, and Sentry staging credentials.
- Smoke-test recipients/data: `SMOKE_SMS_TO`, `SMOKE_EMAIL_TO`, `SMOKE_STAFF_PHONE`, `SMOKE_PORTAL_TOKEN`, and manual OTP codes when prompted.

## Final commands run

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | Pass | Run from a fresh clone of the final handoff commit; installed 652 packages, 0 vulnerabilities. |
| `npx playwright install chromium` | Pass | Chromium browser install command completed successfully before E2E verification. |
| `npm run lint` | Pass | Repository hygiene lint passed for 211 unignored files in the clean checkout. |
| `npm run verify` | Pass | Full gate passed in the clean checkout. |
| `npm audit --omit=dev --json` | Pass | 0 production vulnerabilities. |

## Commands covered by `npm run verify`

| Subcommand | Result | Notes |
| --- | --- | --- |
| `npm run test:api` | Pass | 60 tests: 59 pass, 1 skipped. |
| `npm run typecheck:api` | Pass | API TypeScript check passed. |
| `npm run build:web` | Pass | Next production build passed. |
| `npm run test:web:e2e` | Pass | Playwright pilot workflow passed. |
| `npm run typecheck:mobile` | Pass | Mobile TypeScript check passed. |
| `npm run test:mobile:flows` | Pass | 2 LegalBahi Android Maestro flow definitions verified. |
| `npm run test:deployment` | Pass | Windows scripts, Caddy loopback routing, R2 lifecycle, and 6 migrations verified. |

## Skipped test

- `PostgreSQL pilot runtime migrates and isolates workspaces` is skipped unless `TEST_DATABASE_URL` is set.
- `TEST_DATABASE_URL` was absent in this environment during clean-checkout verification, so PostgreSQL integration proof remains an external/local-infra blocker, not an application test failure.

## Handoff packaging validation

- Existing `.git` metadata was removed and the repository was reinitialized.
- A single root commit was created for the handoff source.
- `node_modules`, `.next`, `.expo`, `test-results`, `playwright-report`, runtime SQLite files, upload folders, `.DS_Store`, and empty runtime folders were removed from the source tree before the commit.
- `CLEAN_HANDOFF.md` documents what belongs in a ZIP/GitHub handoff and what must stay out.

## Coverage added

- Court parser tests for LHC Rawalpindi and Rawalpindi District fixtures.
- Court-specific normalization tests.
- Offline fixture-backed Rawalpindi source fetch test.
- Product API test for Rawalpindi District and LHC Rawalpindi sync, exact matching, calendar update, and unmatched manual-review rows.
- Updated Playwright pilot flow for controlled court selection.

## Warnings

- Node emits `node:sqlite` experimental warnings during local tests. Existing test suite behavior; not a failing condition.
