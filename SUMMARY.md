# LegalBahi Pilot Completion Summary

Date: 2026-06-13

## Completed in this pass

- Created `PLANS.md` as the phased implementation source of truth.
- Added generic court-source support for:
  - Islamabad High Court (`source-ihc`)
  - Lahore High Court Rawalpindi Bench (`source-lhc-rwp`)
  - Rawalpindi District & Sessions / lower courts (`source-rwp-district`)
- Added Rawalpindi/LHC fixture parsers and offline fixture-backed ingestion.
- Wired generic court ingestion through:
  - Fastify API sync route
  - SQLite product store
  - PostgreSQL product store
  - background worker
  - court source health/degraded-state handling
- Added parsed `court_id` to cause-list entries so Rawalpindi District rows can classify civil, family, criminal/magisterial, and sessions matters.
- Added PostgreSQL migration `006_rawalpindi_court_sources.sql`.
- Updated web staff UI:
  - controlled court selector for matter create/edit
  - human-readable pilot court labels
  - source health with official source links
  - generic court-review wording
- Updated mobile product UI to show human-readable pilot court labels.
- Added root scripts: `lint`, `typecheck`, `test`, `test:web`, and `build`.
- Added repository hygiene lint script.
- Cleaned ignored runtime artifacts and rebuilt dependencies with `npm ci`.
- Updated `tsx` to `4.22.4` to remove dev audit findings.

## Verification status

Local verification passes:

- `npm run lint`
- `npm run verify`
- `npm audit --omit=dev --json`

The only skipped automated test is the PostgreSQL integration/migration test that requires `TEST_DATABASE_URL`.

## Remaining external launch proof

- Dedicated VPS deployment.
- Real PostgreSQL production database.
- Real domain and HTTPS.
- Live Twilio OTP/SMS.
- Live Resend email.
- Cloudflare R2 document and backup buckets.
- Sentry project.
- Real court-source smoke against changing court websites.
- Encrypted R2 backup restore drill on the VPS.
- EAS Android internal APK build, install, and real-device test.
