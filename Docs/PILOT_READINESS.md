# Pilot Readiness

## Implemented

- Invite-only lawyer OTP registration and automatic solo workspace.
- Workspace-scoped mutable APIs with cross-workspace regression tests.
- Generated mutable-route security inventory rejects newly exposed routes unless they are authentication-protected or explicitly public.
- Firm-scoped client identities allow the same client phone in separate firms while ambiguous phone-only login fails closed.
- Database-level PostgreSQL constraints for pilot actor types, statuses, match confidence, and notification/import states.
- Normalized court registry/tracked case references, versioned notification templates, and explicit per-channel consent records.
- One-matter portal links gated by client OTP and a short-lived portal-scoped bearer token, with explicit client selection when a matter has multiple clients.
- Client archive revokes OTP login, sessions, portal links, pending notifications, preferences, and consent.
- Matter/client unlink revokes only that matter's portal links and pending notifications while preserving the client's other shared matters.
- Matter/client CRUD foundations, CSV preview/confirm/rejected rows, hearings, conflicts, notes, and private uploads.
- Manual next dates stay synchronized with calendar items; possible conflicts require the same lawyer, same day, and different courts.
- Lawyer web workflows for matter edit/archive, client and party management, document search/visibility, IHC manual review, and notification preferences/history.
- IHC exact-match ingestion, match review API, and database-backed reminder worker.
- Twilio SMS, Resend email, Cloudflare R2, Android internal-build, Caddy, CI, backup, and restore configuration.
- LegalBahi-first web and Android entry points; demo and deferred surfaces are hidden from production navigation.
- LegalBahi Android launcher/adaptive icons, secure session storage, internal EAS profile, and production-line Android export.
- Android matter-document camera upload in addition to hearing-order capture.
- Android invited-lawyer signup, secure session hydration, and checked-in Maestro signup/hearing-update flows.
- Production API and worker runtime use PostgreSQL only; SQLite is limited to explicit development/demo mode.
- Versioned PostgreSQL migration runner and disposable-PostgreSQL integration coverage for signup, workspace isolation, IHC matching, notifications, documents, and exact-matter portal access.
- Executable production smoke command for HTTPS, R2, Twilio, Resend, real OTPs, delivery logs, and exact-matter portal access.
- Windows service environment validation, non-overlapping worker cycles, daily encrypted backup task, and restore scripts.
- Production validation requires separate R2 document and backup buckets, valid invite/registration emails, and supported IHC list types.
- Production preflight rejects placeholder domains, unsafe proxy settings, weak secrets, mismatched web/API origins, and missing backup encryption.
- App services run as `LocalService`, receive only runtime settings, and cannot receive separate R2 backup credentials or the age restore identity.
- Production web builds are marked with their API URL and rejected by service installation when the configured URL differs.
- Host acceptance checks verify service accounts, loopback listeners, HTTPS, the scheduled task, a recent encrypted backup, and optional full smoke execution.
- GitHub uptime checks cover both API readiness and the hosted LegalBahi web app; production smoke submits a Sentry test event.
- Local `main` Git repository is initialized, with generated/runtime uploads and secrets excluded from version control.
- Loopback-proxy-aware per-client rate limits, delivery-time consent checks, and changed-hearing reminder rescheduling.
- Playwright web pilot journey and deployment/mobile-flow contract verifiers in CI.
- Client sessions and portal tokens cannot read staff-only documents; staff/client mutations, successful authentication sessions, and pilot workspace registration are audit logged.
- Raw portal links remain unusable after OTP without the matching short-lived portal scope, and portal-scoped tokens cannot access full client-workspace endpoints.
- Legacy permanent portal verification, portal-upgrade sessions, and unused ingestion reconciliation state are removed by migration.
- Mocked R2 storage contract verifies private randomized object keys and five-minute signed downloads.
- Web and Android sign-out revoke the server session, and production Android builds fail closed when the HTTPS API URL is missing.

## Must be completed before real-data launch

- Run live Twilio, Resend, R2, HTTPS, Android EAS cloud-build, encrypted backup, and R2 restore smoke tests using purchased domain and pilot credentials.
- Create the private GitHub repository and configure protected branch/secrets.
- Configure external error reporting and uptime monitoring accounts.
- Choose a dedicated production VPS or explicitly accept the documented risks of sharing the current VPS with unrelated trading services.

## Verified on June 13, 2026

- `npm run verify` passes with 54 local tests passing and the PostgreSQL-only test skipped when no database URL is supplied.
- PostgreSQL 17 migrations `001_pilot`, `002_pilot_constraints`, `003_client_phone_workspace_scope`, `004_registry_and_notification_templates`, and `005_remove_legacy_pilot_state` apply cleanly and a second migration run is idempotent.
- Disposable PostgreSQL integration run passes all 55 tests with no skips.
- Production `/health/ready` returns `200` against PostgreSQL.
- Production API returns `404` for demo auth, while production web redirects demo and deferred routes to `/overview`.
- Local PostgreSQL custom-format dump/restore drill preserved all five migration versions and the normalized registry/template tables in a clean database.
- IHC live-source fetch succeeds for regular, supplementary, and urgent lists.
- IHC matcher evaluation passes all five known matches and the expected unmatched case.
- Playwright web journey passes from invited signup through matter/client linking, hearing update, protected portal OTP, scoped exact-matter access, and client readback.
- Android production-line export succeeds with LegalBahi icon and package configuration.
- Android Maestro signup and hearing/client-update flows pass structural/package-ID validation; installed-build execution remains an external launch gate.
- Deployment validation confirms separate document/backup bucket enforcement in both service and backup-task installers.
- All ten deployment PowerShell scripts parse successfully under Windows PowerShell 5.1 on the current VPS.
- Read-only VPS assessment confirms Node.js/Git are present, required hosting tools are absent, and unrelated trading services already occupy the shared host.
- `npm audit --omit=dev` reports zero vulnerabilities.
