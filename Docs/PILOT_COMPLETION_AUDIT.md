# Legal Bhai Pilot Completion Audit

Audit date: June 13, 2026

Status meanings:

- **Repository-proven**: implemented and verified locally by code, tests, builds, or checked-in deployment validation.
- **External launch gate**: requires live credentials, DNS, a deployed host, or an installed cloud build.
- **Deferred**: intentionally outside the controlled-pilot scope.
- **Partial**: useful coverage exists, but the original requirement is not fully proven.

## Bottom line

The repository foundation is substantially implemented, but the controlled pilot is **not ready for real users yet**. Live hosting, real provider delivery, encrypted R2 backup restore, installed Android internal-build testing, and GitHub production controls remain unproven.

## Security, authentication, and isolation

| Requirement | Status | Evidence or remaining work |
| --- | --- | --- |
| Invited lawyer signup using phone OTP | Repository-proven + external launch gate | Invite, OTP, registration, and personal-workspace tests pass. A real Twilio OTP must still pass on the hosted API. |
| Personal one-user workspace | Repository-proven | Registration creates an owner membership and empty isolated workspace. |
| No development OTPs, default secrets, or seeded production accounts | Repository-proven | Production validation rejects missing/weak secrets, demo surfaces, seed data, and placeholder hosts; production responses omit `devCode`. |
| Rate limits, OTP attempt limits, input validation, and audit events | Repository-proven | Per-client proxy-aware limits, five OTP attempts, malformed-input tests, and successful auth/registration/portal audit events pass. |
| Centralized mutable-endpoint permissions | Repository-proven | Staff mutations use centralized staff/permission guards; self-service client preferences/messages are explicitly scoped. |
| Workspace ownership on matters, documents, clients, hearings, invoices, and related records | Repository-proven | Broad read/write cross-workspace API tests and PostgreSQL store tests pass. A generated mutable-route inventory test fails when a new route is not authentication-protected or explicitly classified as public. |
| One-matter protected client portal | Repository-proven | Raw link access is denied before and after OTP. OTP returns a short-lived portal-scoped bearer token that exposes one matter and cannot access the full client workspace. |

## Production data and storage

| Requirement | Status | Evidence or remaining work |
| --- | --- | --- |
| PostgreSQL production store and versioned migrations | Repository-proven | Production selects PostgreSQL; five migrations apply and the disposable PostgreSQL suite passes. Migration `005` removes legacy permanent portal verification, portal-upgrade sessions, and unused reconciliation state. |
| SQLite only for development/demo | Repository-proven | Runtime selection forces PostgreSQL in production. |
| Private R2 documents and short-lived downloads | Repository-proven + external launch gate | Production fails closed without R2. Mocked R2 contract proves private randomized keys and five-minute signed downloads. Live R2 upload/download is still required. |
| Encrypted daily PostgreSQL backups, separate bucket, 30-day retention | Repository-proven + external launch gate | Scripts, separate credentials/bucket validation, encryption, schedule, and lifecycle exist. A real backup upload and restore must still pass. |
| Normalized court, matching, notification, consent, and CSV tables | Repository-proven | Present in versioned PostgreSQL migrations and exercised by PostgreSQL integration tests. |
| Hide team, billing, payments, expenses, tasks, appointments, and advanced reports | Repository-proven | Deferred web/API routes are hidden or return `404` in production; these workflows remain outside the pilot. |

## Lawyer workflow

| Requirement | Status | Evidence or remaining work |
| --- | --- | --- |
| Signup/onboarding, matters, clients/parties, hearings, documents, calendar/conflicts, portal links, preferences/history | Repository-proven | API tests, web screens, and Playwright pilot journey pass. |
| CSV template, preview, duplicate validation, confirm, rejected rows | Repository-proven | API and workflow tests pass. |
| Manual next dates for Pakistani courts | Repository-proven | Manual dates synchronize with calendar; different-court same-day conflicts are tested. |
| Hearing order and notes upload | Repository-proven + external launch gate | Web/mobile flows and private storage path exist; live hosted R2 upload remains required. |

## IHC automation and notifications

| Requirement | Status | Evidence or remaining work |
| --- | --- | --- |
| Regular, supplementary, and urgent IHC ingestion | Repository-proven | Provider, fixture parser, canonicalization, and list-type tests pass. |
| Normalize, deduplicate, exact-match, and manual review | Repository-proven | PostgreSQL integration proves exact matching, unmatched review, manual linking, and calendar updates. |
| Database-backed worker without Redis | Repository-proven | PostgreSQL job claims use row locking and `SKIP LOCKED`; worker records attempts and retries. |
| 7 PM lawyer agenda, 24-hour client reminder, post-hearing update | Repository-proven + external launch gate | Scheduling, idempotency, retries, provider failures, consent, and opt-out tests pass. Real Twilio/Resend delivery and logs must still pass. |
| WhatsApp automation | Deferred | Intentionally outside the pilot. |

## Android, hosting, and operations

| Requirement | Status | Evidence or remaining work |
| --- | --- | --- |
| Legal Bhai Android identity, secure sessions, production API, pilot flows | Repository-proven | Package `pk.legalbahi.app`, Legal Bhai assets, SecureStore, production fail-closed API config, typecheck, flow validation, and Android export pass. |
| Expo/EAS internal Android build installed against hosted API | External launch gate | EAS is not logged in in this environment; no installed internal APK has been tested. |
| Windows VPS PostgreSQL/API/worker/web/Caddy deployment | Repository-proven + external launch gate | Deployment scripts and host verifier pass repository checks. The current VPS is shared and has not been modified or accepted for production. |
| Permanent domain and HTTPS | External launch gate | Caddy still contains placeholder domains; permanent DNS/HTTPS are not configured. |
| Private GitHub repo, protected branch, CI, error reporting, uptime | Partial + external launch gate | Local `main` Git repository, CI/uptime workflows, Sentry integration, and runtime-data exclusions exist. Private remote, Actions secrets, branch protection, and live Sentry/uptime checks remain unproven. |

## Acceptance decision

Repository verification passes, but pilot launch approval is **not granted** until all of these have recorded passing evidence:

1. Permanent web/API domain and live HTTPS deployment.
2. Real staff OTP, client portal OTP, Twilio SMS, and Resend email smoke tests.
3. Live private R2 upload/download.
4. Encrypted backup upload to the separate R2 bucket and successful restore.
5. Expo/EAS internal APK installed and tested against the hosted API.
6. Private GitHub repository, protected branch, required Actions secrets, Sentry, and uptime checks.
7. Dedicated VPS selection or explicit written acceptance of the current shared-host risk.

## Remaining repository concerns

No known locally actionable pilot blocker remains from this audit. The remaining launch gates require external accounts, credentials, DNS, a production-host decision, or an installed Android cloud build.
