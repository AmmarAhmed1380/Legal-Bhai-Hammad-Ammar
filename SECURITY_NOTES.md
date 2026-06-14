# LegalBahi Security Notes

Date: 2026-06-13

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
