# LegalBahi Pilot Acceptance Report

Date: 2026-06-13

## Acceptance status

| Area | Status | Evidence |
| --- | --- | --- |
| Backend API | Pass local | API tests pass; product routes cover auth, matters, clients, portal, documents, notifications, court sync. |
| Web lawyer/staff dashboard | Pass local | Next build and Playwright pilot workflow pass. |
| Mobile lawyer app | Pass local | Typecheck and Maestro flow structural validation pass. Real APK install is external. |
| Client portal | Pass local | Playwright portal OTP flow and API portal scope tests pass. |
| PostgreSQL migrations | Partial external | 6 migrations verified as assets. Disposable PostgreSQL test requires `TEST_DATABASE_URL`. |
| OTP auth | Pass local | Staff/client OTP and portal OTP tests pass with mock/dev providers. Real Twilio is external. |
| Matters/cases | Pass local | CRUD/import/isolation flows covered by API tests and web E2E. |
| Clients | Pass local | Client create/link/unlink/archive and portal scope tests pass. |
| Hearings/calendar | Pass local | Hearing update, calendar sync, conflict tests pass. |
| IHC tracking | Pass local | Existing IHC fixture/parser/provider failure tests pass. Live IHC smoke is external. |
| Rawalpindi tracking | Pass local | Added fixture parser/API sync tests for LHC Rawalpindi and Rawalpindi District/lower courts. Live source smoke is external. |
| Documents | Pass local | Upload/download/private portal authorization and signed URL tests pass. Live R2 is external. |
| Notifications | Pass local | Mock provider, notification preferences, consent, and job tests pass. Live Twilio/Resend are external. |
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

Blocked externally:

- `TEST_DATABASE_URL` PostgreSQL integration run.
- Production smoke with real OTP, HTTPS, R2, Twilio, Resend, Sentry, and notification history.
- R2 encrypted backup restore drill.
- Android internal APK install and real-device pilot flow.
