# Legal Bhai Security Notes

Date: 2026-06-13

## Staging validation security status

- No staging secret file was available, so `.env.staging` was not created and no placeholder secrets were written.
- `.gitignore` excludes `.env.*` except `.env.example`; a future `.env.staging` will remain untracked by default.
- `npm run lint` passed and confirmed repository hygiene for unignored files.
- `npm run verify` passed local security-sensitive coverage, including cross-firm authorization, portal scoping, document authorization, production config validation, OTP/provider adapter tests, and Playwright client-portal flow.
- `npm run smoke:production` failed closed before network activity because required staging/production variables were absent. This is the intended behavior for missing secrets/config.
- Real Twilio, Resend, R2, Sentry, PostgreSQL, and hosted API/web validation remains blocked until staging credentials and test-only smoke data are provided.

## Fixed / verified controls

- Production config validation exists and fails closed for missing required secrets, placeholder hosts, weak secrets, shared R2 buckets, invalid Twilio sender, invalid Resend sender, disabled sync, and unsafe proxy settings.
- Demo surfaces and seed data are rejected in production.
- Staff/client OTP flows, refresh, logout, portal scoping, and cross-workspace access are covered by API tests.
- Client portal tests verify exact matter scope and prevent broad client workspace access from raw portal links.
- Document authorization tests cover private document denial and signed download behavior.
- Repository lint checks unignored files for runtime artifacts, local env files, SQLite files, logs, upload data, and obvious private key/AWS key material.
- Production dependency audit is clean: `npm audit --omit=dev` reports 0 vulnerabilities.

## Security-sensitive changes made

- Court-source sync now fails closed into `degraded` health state instead of silently treating provider failures as success.
- Rawalpindi source matching only auto-matches exact normalized court/case/year rows with full confidence.
- Manual review calendar entries use source-specific review types rather than always `manual_ihc_review`.
- Cause-list entries now retain parsed `court_id`, reducing wrong-court manual review risk.

## Remaining risks

- Live court websites can change markup or block requests. Production must treat court data as informational and require lawyer verification.
- Malware scanning is still a placeholder/hook; no live malware scanning provider was configured locally.
- Full penetration testing was not performed.
- Real OTP/email/storage/Sentry behavior needs production smoke with live credentials.
- VPS hardening must be verified on the dedicated host, including firewall, service accounts, file ACLs, backup task, and loopback-only app ports.

## External security blockers

- Twilio credentials and sender.
- Resend API key and sending domain.
- Cloudflare R2 document bucket and separate backup bucket with separate keys.
- Sentry DSN.
- Dedicated VPS with domain/HTTPS and locked-down firewall.
- R2 encrypted backup restore drill.
