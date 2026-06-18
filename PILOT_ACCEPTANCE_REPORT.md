# LegalBahi Pilot Acceptance Report

Date: 2026-06-13

## Staging validation update - 2026-06-13 local shell date

Local gates passed again: `npm ci`, `npx playwright install chromium`, `npm run lint`, `npm run verify`, and `npm audit --omit=dev --json`.

External staging validation did not complete because no staging env file path or exported staging variables were available. The PostgreSQL integration test still skips without `TEST_DATABASE_URL`; `npm run smoke:production` fails closed on missing required env before any provider/network smoke can run.

Mobile Android export passed with a placeholder HTTPS API URL, proving the local export path. The actual staging API URL assertion remains blocked until `EXPO_PUBLIC_API_URL` is provided.

Live court-source status: IHC has a live fetch path when enabled by env. Rawalpindi District/lower courts and LHC Rawalpindi Bench are currently fixture-backed in the repo, so those live smoke checks are not supported yet.

## Acceptance status

| Area | Status | Evidence |
| --- | --- | --- |
| Backend API | Pass local | API tests pass; product routes cover auth, matters, clients, portal, documents, notifications, court sync. |
| Web lawyer/staff dashboard | Pass local | Next build and Playwright pilot workflow pass. |
| Mobile lawyer app | Pass local / staging URL blocked | Typecheck, Maestro flow structural validation, and local Android export pass. Real staging API URL validation and APK install require staging env/device. |
| Client portal | Pass local | Playwright portal OTP flow and API portal scope tests pass. |
| PostgreSQL migrations | Partial external | 6 migrations verified as assets. Disposable PostgreSQL test still requires `TEST_DATABASE_URL`. |
| OTP auth | Pass local / Twilio blocked | Staff/client OTP and portal OTP tests pass with mock/dev providers. Real Twilio staging OTP is blocked by missing env/test numbers. |
| Matters/cases | Pass local | CRUD/import/isolation flows covered by API tests and web E2E. |
| Clients | Pass local | Client create/link/unlink/archive and portal scope tests pass. |
| Hearings/calendar | Pass local | Hearing update, calendar sync, conflict tests pass. |
| IHC tracking | Pass local / live blocked | Existing IHC fixture/parser/provider failure tests pass. Live IHC smoke requires staging env and live fetch enabled. |
| Rawalpindi tracking | Pass local / live unsupported | Fixture parser/API sync tests for LHC Rawalpindi and Rawalpindi District/lower courts pass. Current Rawalpindi sources are fixture-backed, not live adapters. |
| Documents | Pass local / R2 blocked | Upload/download/private portal authorization and signed URL tests pass. Live R2 staging validation is blocked by missing env. |
| Notifications | Pass local / providers blocked | Mock provider, notification preferences, consent, and job tests pass. Live Twilio/Resend staging validation is blocked by missing env. |
| Audit logging | Pass local | Audit routes and event listing are present; security-sensitive audit coverage exists in API tests. |
| Security/access control | Pass local | Cross-firm, portal, route auth, production config, and document authorization tests pass. |
| Deployment readiness | Pass local | Windows script/Caddy/R2/migration verifier passes. VPS smoke remains external. |
| Clean repository | Pass source | Runtime artifacts are ignored and cleaned from source handoff; repo lint passes. |

## Final gate

Passed:

- `npm ci`
- `npm run lint`
- `npm run verify`
- `npm audit --omit=dev --json`
- Mobile Android export with a placeholder HTTPS API URL.

Blocked externally:

- `TEST_DATABASE_URL` PostgreSQL integration run.
- Staging smoke with real OTP, HTTPS API/web, R2, Twilio, Resend, Sentry, and notification history.
- R2 encrypted backup restore drill.
- Actual staging `EXPO_PUBLIC_API_URL` verification, Android internal APK install, and real-device pilot flow.
- Live Rawalpindi District/lower court and LHC Rawalpindi Bench source checks until live adapters exist.
