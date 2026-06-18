# Legal Bhai Pilot-Ready Implementation Plan

Target: a controlled pilot for Islamabad High Court and Rawalpindi legal practice work, with web, mobile, client portal, backend API, PostgreSQL, secure document storage, OTP auth, court-source tracking, tests, and deployment handoff.

Status legend: Not started, In progress, Blocked external, Verified.

## Phase 0 - Baseline Repo Inspection

Status: Verified locally before implementation.

Files likely affected:
- `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/mobile/package.json`
- `Docs/**`
- `infra/postgres/migrations/**`
- `infra/windows/**`

Features to implement/fix:
- Record current scripts, test commands, app structure, migrations, docs, and known cleanup artifacts.
- Identify missing root scripts and production-readiness gaps.

Tests to add/run:
- `npm run typecheck:api`
- `npm run test:api`
- `npm run build:web`
- `npm run test:web:e2e`
- `npm run typecheck:mobile`
- `npm run test:mobile:flows`
- `npm run test:deployment`

Acceptance criteria:
- Current repo state and failures are known before implementation.
- No production claim is made without verification.

Risks/blockers:
- External services are unavailable locally unless credentials are provided.
- Current repo includes runtime artifacts that must be cleaned before handoff.

## Phase 1 - Root Scripts, Clean Repo, and Local Developer Workflow

Status: Verified locally.

Progress:
- Added root `lint`, `typecheck`, `test`, `test:web`, and `build` scripts.
- Added `scripts/lint-repo.mjs` to check unignored source files for runtime artifacts and obvious secret material.
- Expanded `.gitignore` for `__MACOSX` and SQLite sidecar files.
- Removed ignored runtime artifacts, rebuilt dependencies with `npm ci`, and verified `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:web`, `npm run test:web`, `npm run test:deployment`, and `npm run verify` pass locally.
- Updated `tsx` to `4.22.4`; `npm audit --omit=dev --json` reports 0 vulnerabilities.

Files likely affected:
- `package.json`
- `.gitignore`
- `scripts/**`
- `Docs/**`
- `TEST_REPORT.md`

Features to implement/fix:
- Add root `lint`, `typecheck`, `test`, and `build` scripts.
- Add a repository hygiene check for committed runtime artifacts.
- Remove local `node_modules`, `.DS_Store`, SQLite runtime files, upload data, logs, Expo cache, and build outputs from handoff state.
- Ensure `npm ci` and local scripts work after a clean install.

Tests to add/run:
- Root script smoke tests for lint/typecheck/test/build.
- Deployment asset verification.

Acceptance criteria:
- A new developer can clone, run `npm ci`, and run the standard checks.
- Runtime and generated files are ignored and not part of source handoff.

Risks/blockers:
- Removing local artifacts is destructive to runtime demo data; only do this after implementation or when explicitly ready for cleanup.

## Phase 2 - Authentication, Sessions, Roles, and Audit Logging

Status: Not started.

Files likely affected:
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/config.ts`
- `apps/api/test/**`
- `infra/postgres/migrations/**`
- `packages/shared/src/**`

Features to implement/fix:
- Staff OTP request/verify with rate limits.
- Lawyer onboarding from pilot invite and workspace creation.
- Client portal OTP verification.
- Session refresh, revoke, and logout.
- Production-safe cookies/session settings.
- Disable admin/dev-only routes in production.
- Audit events for OTP request, OTP verify, login, portal access, document access, and failed authorization.

Tests to add/run:
- Auth API tests for staff OTP, client OTP, refresh, revoke, logout.
- Rate-limit tests for OTP spam and brute force.
- Production config validation tests.
- Audit-event assertions.

Acceptance criteria:
- Cross-firm users cannot read/write each other's data.
- Client portal access is scoped to explicitly shared matter/client data.
- OTP brute-force and request spam are rate-limited.

Risks/blockers:
- Live SMS requires Twilio credentials and verified sending numbers.

## Phase 3 - Matters, Cases, Clients, and Portal Memberships

Status: Not started.

Files likely affected:
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/web/app/product/staff/page.tsx`
- `apps/mobile/App.tsx`
- `packages/shared/src/product.ts`
- `infra/postgres/migrations/**`
- `apps/api/test/**`

Features to implement/fix:
- Matter create/edit/archive with controlled court selection.
- Matter fields: title, court, case number, type, filing number when present, institution date, status, stage, bench/judge, next date, tentative date, parties, opposing counsel, notes, tags.
- Court-specific case normalization for IHC, LHC Rawalpindi Bench, Rawalpindi District & Sessions, civil, family, and criminal/magisterial courts.
- Matter search/filter/sort by court, next date, status, client, party, and case number.
- Client create/edit/archive, multiple clients per matter, portal invite/link creation, client-visible summaries, preferences, and audit trail.

Tests to add/run:
- Matter CRUD, update, archive, search/filter/sort.
- Cross-firm isolation.
- Client CRUD and matter membership.
- Portal visibility and revoked/expired portal link tests.

Acceptance criteria:
- Matter and client workflows work from web and mobile.
- Client can see only shared matters and cannot enumerate matter IDs.
- PostgreSQL and local store behavior match.

Risks/blockers:
- Existing web/mobile UI is compact and may need careful scoping to avoid bloated rewrites.

## Phase 4 - Hearings, Calendar, Reminders, and Timeline

Status: Not started.

Files likely affected:
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/notification-schedule.ts`
- `apps/web/app/product/staff/page.tsx`
- `apps/mobile/App.tsx`
- `packages/shared/src/product.ts`
- `infra/postgres/migrations/**`
- `apps/api/test/**`

Features to implement/fix:
- Add/edit/delete hearing.
- Hearing fields: date/time, court, courtroom, bench/judge, stage, order summary, next date, attendance, outcome.
- Calendar monthly, weekly, and list views on web; calendar view on mobile.
- Reminder jobs for upcoming hearings.
- Conflict warnings for same-day/time/court.
- IHC current-week/tentative-date warning.
- Manual verification fields: `verified_by`, `verified_at`, `source_url`, `confidence`.
- Matter timeline with hearings, documents, messages, client updates, court matches, and audit events.

Tests to add/run:
- Hearing CRUD and update workflow.
- Reminder job creation.
- Conflict detection.
- Client portal and mobile sync visibility.
- Timeline ordering and authorization tests.

Acceptance criteria:
- Hearing updates sync web/mobile/client portal.
- Same-day conflicts are visible.
- IHC tentative/current-week warning is shown.

Risks/blockers:
- Calendar UX may need Playwright coverage across responsive breakpoints.

## Phase 5 - Court Source Registry, IHC, and Rawalpindi Tracking

Status: In progress.

Progress:
- Added generic court-source registry and fixture-backed adapters for IHC, LHC Rawalpindi Bench, and Rawalpindi District.
- Wired source-aware ingestion through SQLite store, PostgreSQL store, API sync route, and background worker.
- Added parsed `court_id` on cause-list entries for Rawalpindi lower-court classification.
- Added PostgreSQL migration `006_rawalpindi_court_sources.sql`.
- Added parser and API sync tests for Rawalpindi District and LHC Rawalpindi fixture ingestion.
- Verified `npm run typecheck:api` and `npm run test:api` pass locally. PostgreSQL runtime migration test remains skipped without `TEST_DATABASE_URL`.

Files likely affected:
- `apps/api/src/lib/court-sources.ts`
- `apps/api/src/lib/ihc.ts`
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/worker.ts`
- `apps/api/test/fixtures/**`
- `apps/api/test/**`
- `packages/shared/src/product.ts`
- `infra/postgres/migrations/**`
- `apps/web/app/product/staff/page.tsx`
- `apps/mobile/App.tsx`

Features to implement/fix:
- Generic `CourtSource` abstraction and registry.
- IHC adapter behind the generic abstraction.
- LHC Rawalpindi Bench fixture-backed adapter for regular, supplementary, urgent lists.
- Rawalpindi District & Sessions fixture-backed adapter with judge-wise/list-row parsing and lower-court classification.
- Manual CSV/PDF/test fixture source hooks.
- Source health, last ingestion run, raw parsed data, normalized cause-list entries, matter matches, confidence scores.
- Exact auto-match by court/case/year only; low-confidence entries require manual review.
- Accept/reject manual review and court-date change alerts.
- Source failure/degraded state that never corrupts calendar data.

Tests to add/run:
- IHC parser fixture tests.
- LHC Rawalpindi parser tests.
- Rawalpindi District parser tests.
- Exact match, wrong court, duplicate case number, fuzzy/low-confidence rejection.
- API sync tests for IHC and Rawalpindi.
- Worker failure/degraded-state tests.

Acceptance criteria:
- Ingestion runs locally using fixtures without internet.
- UI shows source, confidence, health, and verification state.
- Lawyer can manually confirm a court match.

Risks/blockers:
- Official court websites may change, time out, or block automation. Production must degrade safely and require lawyer verification.

## Phase 6 - Document Vault and Secure Storage

Status: Not started.

Files likely affected:
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/storage.ts`
- `apps/web/app/product/staff/page.tsx`
- `apps/mobile/App.tsx`
- `packages/shared/src/product.ts`
- `infra/postgres/migrations/**`
- `apps/api/test/**`

Features to implement/fix:
- Web upload and mobile camera/gallery upload.
- Categories: Pleading, Order, Evidence, Notice, CNIC, Vakalatnama, Receipt, Cause list, Other.
- Private by default; share/unshare with client portal.
- S3/R2 production provider and local development provider.
- Metadata: matter, client, category, filename, MIME, size, uploaded by/at, SHA-256, visibility.
- Malware-scan placeholder hook.
- Signed download URL expiration.
- Audit logs for upload/download/share/delete.

Tests to add/run:
- Document upload validation.
- Unsupported type/size rejection.
- Private vs portal-visible authorization.
- Signed URL expiry behavior.
- Mobile mocked upload flow.

Acceptance criteria:
- Client cannot access private documents.
- Signed URLs expire.
- Production storage can be validated with R2 credentials.

Risks/blockers:
- Real R2 bucket validation requires Cloudflare credentials and configured CORS/lifecycle.

## Phase 7 - Notifications and Provider Abstractions

Status: Not started.

Files likely affected:
- `apps/api/src/lib/providers.ts`
- `apps/api/src/lib/notification-schedule.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/worker.ts`
- `apps/web/app/product/staff/page.tsx`
- `packages/shared/src/product.ts`
- `infra/postgres/migrations/**`
- `apps/api/test/**`

Features to implement/fix:
- SMS/email provider abstractions with dev/mock/staging/production modes.
- In-app notifications.
- Notification jobs/attempts tables and retry policy.
- Failure logging and notification history.
- Templates for OTP, hearing reminder, hearing update, shared document, portal link, court match, source failure.
- Notification preferences and quiet hours if feasible.

Tests to add/run:
- Mock provider tests.
- Job state transition tests.
- Template rendering tests.
- Failed send visibility tests.

Acceptance criteria:
- No real SMS/email is sent in tests.
- Failed sends are visible in notification history.
- Production refuses to use mock providers unless explicitly configured for staging/dev.

Risks/blockers:
- Live Twilio and Resend tests require production credentials.

## Phase 8 - Web Lawyer/Staff Dashboard and Client Portal UX

Status: In progress.

Progress:
- Replaced web matter create/edit free-text court fields with controlled pilot court selectors.
- Court health and court-review UI now show human-readable IHC/Rawalpindi court labels and source warnings.
- Updated Playwright pilot workflow for controlled court selection.
- Verified `npm run build:web` and `npm run test:web` pass locally.

Files likely affected:
- `apps/web/app/product/staff/page.tsx`
- `apps/web/app/product/portal/**`
- `apps/web/app/**`
- `apps/web/tests/**`
- `packages/shared/src/product.ts`

Features to implement/fix:
- Staff dashboard, matters, matter detail, clients, calendar, alerts, documents, court matches, settings, notification preferences, portal-link management.
- Controlled court selector backed by registry.
- Sync health, degraded state, manual review, source confidence, and verification display.
- Empty, loading, error, and permission denied states.
- Mobile-friendly client portal with OTP, matter summary, next hearing, recent updates, shared documents, lawyer contact, expiry/revocation.

Tests to add/run:
- Playwright pilot journey from login to matter/client/hearing/document/portal/court-match flow.
- Portal expired/revoked token E2E.
- Responsive layout smoke tests.

Acceptance criteria:
- Lawyer can complete the full web pilot workflow.
- Client portal reveals only allowed matter/client scope.
- Error states do not leak internal details.

Risks/blockers:
- Current single-page staff UI may need incremental refactoring to keep complexity manageable.

## Phase 9 - Mobile Lawyer App

Status: In progress.

Progress:
- Mobile product app now renders human-readable pilot court labels for matter detail and matter list rows.
- Verified `npm run typecheck:mobile` and `npm run test:mobile:flows` pass locally through root checks.

Files likely affected:
- `apps/mobile/App.tsx`
- `apps/mobile/package.json`
- `apps/mobile/maestro/**`
- `apps/mobile/**/*.test.*`
- `packages/shared/src/product.ts`

Features to implement/fix:
- OTP login and secure session storage.
- Matters list/detail.
- Calendar and alerts.
- Hearing update workflow.
- Camera/gallery document upload.
- Offline-safe hearing-update draft if feasible.
- Pull-to-refresh, error states, and logout.
- Internal APK configuration for production API marker.

Tests to add/run:
- Mobile typecheck.
- Mobile flow structural validation.
- Mobile smoke/unit tests for auth, matter list, calendar, upload mock, logout.

Acceptance criteria:
- Mobile can login, view matters/calendar, add hearing update, upload document, view alerts, and logout.
- APK build instructions are complete.

Risks/blockers:
- Real device APK install and live production flow require EAS/device access outside local test environment.

## Phase 10 - PostgreSQL Migrations and Store Parity

Status: Not started.

Files likely affected:
- `infra/postgres/migrations/**`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/test/postgres-product.test.ts`
- `scripts/**`

Features to implement/fix:
- Ordered migrations with idempotency where expected.
- Court registry rows and court source rows for IHC, LHC Rawalpindi Bench, and Rawalpindi District/lower courts.
- Missing `firm_id` scoped indexes, foreign keys, cascades, and unique constraints.
- Audit, notification, ingestion, match, document indexes.
- Document type constraints matching shared types.

Tests to add/run:
- Fresh PostgreSQL migration test when `TEST_DATABASE_URL` is available.
- Migration asset validation.
- SQLite/local store and PostgreSQL store parity tests.

Acceptance criteria:
- Fresh PostgreSQL migration succeeds.
- No production-only table is missing from store implementation.
- Migrations are documented and ordered.

Risks/blockers:
- Disposable PostgreSQL validation is blocked without `TEST_DATABASE_URL`.

## Phase 11 - Security Review and Hardening

Status: Not started.

Files likely affected:
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/config.ts`
- `apps/api/test/**`
- `SECURITY_NOTES.md`

Features to implement/fix:
- Cross-firm authorization.
- Client portal authorization.
- Session and cookie security.
- OTP rate limiting.
- CORS/CSRF review.
- File access and signed URL authorization.
- Secrets handling and production env validation.
- Safe error messages.
- Audit logs for security-sensitive actions.

Tests to add/run:
- Cross-firm read/write denial.
- Portal enumeration denial.
- Document private access denial.
- Failed authorization audit event tests.
- Production config validation tests.

Acceptance criteria:
- Highest-risk authorization failures have automated tests.
- `SECURITY_NOTES.md` records fixed risks and remaining external risks.
- No secrets are committed.

Risks/blockers:
- Full penetration testing is out of local scope; this phase covers repository-grounded controls and tests.

## Phase 12 - Deployment Readiness and Operations

Status: Not started.

Files likely affected:
- `.env.example`
- `.env.production.example`
- `Dockerfile`
- `docker-compose.yml`
- `infra/windows/**`
- `Docs/**`
- `scripts/**`
- `DEPLOYMENT_READY.md`
- `.github/workflows/**`

Features to implement/fix:
- Production env validation.
- Windows VPS deployment scripts/docs for Node 22, PostgreSQL, Caddy, NSSM, age, PostgreSQL client tools, AWS CLI, firewall.
- HTTPS setup for `app.<domain>` and `api.<domain>`.
- PostgreSQL migration command.
- Backup and restore commands.
- R2 bucket/CORS/lifecycle notes.
- Twilio and Resend setup notes.
- Smoke-test and production validation scripts.
- CI workflow if suitable.

Tests to add/run:
- Deployment asset validation.
- Smoke-test script with mock/staging providers.
- Backup/restore script syntax checks.

Acceptance criteria:
- VPS operator can deploy from docs.
- Production refuses to boot without required env vars.
- Missing external credentials are listed clearly.

Risks/blockers:
- Dedicated VPS, domain, R2, Twilio, Resend, Sentry, and Android signing are external blockers.

## Phase 13 - Final Verification and Reports

Status: In progress.

Progress:
- Created `SUMMARY.md`.
- Created `TEST_REPORT.md`.
- Created `SECURITY_NOTES.md`.
- Created `DEPLOYMENT_READY.md`.
- Created `PILOT_ACCEPTANCE_REPORT.md`.
- Final local gate passed after clean `npm ci`: `npm run lint`, `npm run verify`, and `npm audit --omit=dev --json`.

Files likely affected:
- `SUMMARY.md`
- `TEST_REPORT.md`
- `SECURITY_NOTES.md`
- `DEPLOYMENT_READY.md`
- `PILOT_ACCEPTANCE_REPORT.md`
- `PLANS.md`

Features to implement/fix:
- Final summary of completed work.
- Test report with commands and pass/fail results.
- Security notes with fixed risks and remaining risks.
- Deployment steps and environment variable list.
- Acceptance mapping for every pilot requirement.
- Remaining external blocker list.

Tests to add/run:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:api`
- `npm run test:web` or Playwright equivalent
- `npm run build`
- Mobile validation command available in repo

Acceptance criteria:
- TypeScript passes.
- Lint passes or justified exceptions are documented.
- API tests pass.
- Critical E2E pilot flow passes.
- Production config validation exists.
- Cross-firm, portal authorization, court-source, and document access-control tests pass.
- App can run locally after clean install.

Risks/blockers:
- Live production smoke, real OTP, R2 upload/download, backup restore drill, and installed Android APK validation require external services and infrastructure.
