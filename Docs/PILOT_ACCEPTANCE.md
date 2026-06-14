# Controlled Pilot Acceptance Matrix

## Repository-proven

| Gate | Evidence |
| --- | --- |
| Invite-only real-OTP architecture | Invite, OTP request/attempt limits, registration, personal workspace API tests, and successful authentication/registration audit events |
| No development credentials in production | Production environment validation, fail-closed Android API configuration, and production route-guard tests |
| Workspace isolation | Broad read/write boundary suite, generated mutable-route security inventory, and disposable PostgreSQL integration |
| Exact-matter client portal | Raw links expose zero matters before and after OTP; the matching short-lived portal scope exposes exactly one matter and cannot access the full client workspace |
| PostgreSQL production runtime | Five versioned migrations, normalized court/reference and notification-template/consent tables, legacy-state cleanup, constraints, idempotent migration run, and restore drill |
| Private documents | R2-only production storage, mocked private-key/five-minute signed-download contract, and mandatory separate document/backup buckets and credentials |
| Lawyer workflow | Matters, clients, parties, hearings, documents, synchronized manual dates, different-court conflict detection, CSV, review queue, preferences/history |
| IHC automation | Regular, supplementary, urgent parsing; exact matching; unmatched review |
| Reminder worker | Database claims, versioned templates, idempotency, three-attempt retry limit, active-recipient and explicit consent/opt-out enforcement, provider failures, non-overlapping guarded cycles |
| Pilot journey | API and Playwright journeys cover invited signup through matter/client linking, hearing, client update, OTP portal, and client readback |
| Android internal app | LegalBahi branding, secure sessions with server-side logout, matters, calendar, alerts, client updates, hearing and document photos |
| Android workflow automation | Checked-in Maestro flows cover invited signup and an existing lawyer's hearing/client-update journey; CI validates flow/package consistency |
| Windows deployment | Caddy HTTPS config, loopback-only least-privilege services, fail-closed preflight/web build marker, daily encrypted backup task, restore tooling, and host verifier |
| CI | Dependency audit, migrations, API/PostgreSQL tests, Playwright web journey, web build, mobile flow/typecheck/export, Linux deployment verifier, Windows PowerShell parser/preflight, dump/restore drill |

## External launch gates

These require accounts or infrastructure and cannot be proven from the repository:

- Permanent LegalBahi domain and DNS.
- Dedicated VPS selection or explicit acceptance of the [current shared-host risk](VPS_ASSESSMENT.md), followed by deployment with live HTTPS.
- Live Twilio, Resend, R2, and Sentry credentials.
- Successful `npm run smoke:production` with real staff/client OTPs.
- Successful encrypted backup upload and restore from the separate R2 backup bucket.
- Expo EAS Android internal cloud build installed and tested against the hosted API.
- Private GitHub repository, protected branch, Actions secrets, and uptime secret.

Do not invite real-data pilot users until every external launch gate has a recorded passing result.

See [PILOT_COMPLETION_AUDIT.md](PILOT_COMPLETION_AUDIT.md) for the strict requirement-by-requirement status and retained-code concerns.
