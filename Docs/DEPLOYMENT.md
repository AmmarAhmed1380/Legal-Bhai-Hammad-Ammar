# Legal Bhai Controlled Pilot Deployment

## Required services

- Windows VPS with Node.js 22, native PostgreSQL, Caddy, NSSM, `age`, PostgreSQL client tools, and AWS CLI.
- Permanent web and API domains pointing to the VPS.
- Private Cloudflare R2 document and backup buckets with separate least-privilege API tokens.
- Twilio SMS sender and Resend sending domain.

## Release procedure

1. Purchase the permanent domain and point the web and API DNS records to the VPS.
2. Copy `.env.example` to `C:\Legal Bhai\.env.production` and replace every production secret. Generate the `age` recipient/private key separately and set `BACKUP_AGE_RECIPIENT` and `BACKUP_AGE_IDENTITY`.
3. Restrict `C:\Legal Bhai\.env.production` and the age private key to administrators and `SYSTEM`.
4. Replace placeholder domains in `infra/windows/Caddyfile`. Permit inbound public traffic only on ports `80` and `443`; API and web services bind to loopback for Caddy.
5. Run `npm ci`, `npx playwright install chromium`, `npm audit --omit=dev --audit-level=moderate`, and `npm run verify`.
6. Run the production web build wrapper. It validates the production environment and Caddy hosts, builds with the permanent API URL, and writes a marker that the service installer verifies:

```powershell
.\infra\windows\build-web.ps1
```
7. Apply versioned migrations twice; the second run must apply nothing:

```powershell
.\infra\windows\migrate-postgres.ps1
.\infra\windows\migrate-postgres.ps1
```

8. Install or update API, worker, and web services:

```powershell
.\infra\windows\install-services.ps1
```

The installer restarts running services after applying updated commands and environment values.

9. Install Caddy as a Windows service and point it to `C:\Legal Bhai\infra\windows\Caddyfile`.
10. Apply `infra/r2/lifecycle.json` to the separate R2 backup bucket and install the daily encrypted backup task:

```powershell
.\infra\windows\install-backup-task.ps1 -DailyAt "02:00"
```

11. Set `EXPO_PUBLIC_API_URL` in the EAS `preview` environment to the permanent HTTPS API URL and build Android internal distribution:

```powershell
eas build --platform android --profile internal
```

12. Configure the private GitHub repository, protected `main` branch, Actions secrets, Sentry project, and uptime secrets: `LEGALBAHI_API_HEALTH_URL`, `LEGALBAHI_WEB_URL`, and `UPTIME_SECRET`.

## Required production settings

- Keep `ENABLE_DEMO_SURFACES=false` and `ENABLE_PRODUCT_SEED_DATA=false`.
- Set `IHC_SYNC_ENABLED=true`.
- Use a random `JWT_SECRET` of at least 32 characters and a separate random `PILOT_ADMIN_SECRET`.
- The service installer forces the API environment to `HOST=127.0.0.1` and `PORT=3001`, and the web service to `HOSTNAME=127.0.0.1` and `PORT=3000`.
- API, worker, and web services run as `NT AUTHORITY\LocalService`, not `LocalSystem`.
- Keep `TRUST_PROXY_LOOPBACK=true` so Fastify accepts Caddy's forwarded client IP only from loopback and applies rate limits per real client.
- The web service receives only public web settings; it does not receive database, JWT, Twilio, Resend, R2, or backup secrets.
- API and worker services receive document-storage credentials but never receive backup R2 credentials or the age private identity.
- Do not store smoke-test OTP codes or portal tokens in `.env.production`.

## Executable production smoke test

Before running, create a new one-matter portal link for a smoke-test client and ensure the smoke-test lawyer has at least one successfully delivered notification in history. In the current PowerShell session set:

```powershell
$env:SMOKE_SMS_TO = "03001234567"
$env:SMOKE_EMAIL_TO = "pilot-smoke@example.com"
$env:SMOKE_STAFF_PHONE = "03001234567"
$env:SMOKE_PORTAL_TOKEN = "new-unverified-portal-token"
.\infra\windows\run-production-smoke.ps1
```

The command prompts for the real staff and client OTPs. It fails unless all of these pass:

- HTTPS API/web readiness and production route guards.
- Private R2 upload, five-minute signed download, and cleanup.
- Twilio SMS and Resend email provider requests.
- Sentry event submission and flush.
- Real staff OTP login and authenticated workspace reads.
- At least one successfully delivered and logged worker notification.
- No portal matter from the raw link before or after OTP; exactly one linked matter with the matching short-lived portal scope; no full client-workspace access from that scope.

After the daily backup task has completed once, run the host acceptance check. Add `-RunSmoke` for the launch-gate run:

```powershell
.\infra\windows\verify-production-host.ps1 -RunSmoke
```

It fails unless API, worker, web, and Caddy services are running; ports `3000` and `3001` are loopback-only; the web build matches the configured API; the backup task last succeeded; an encrypted R2 backup is newer than 26 hours; HTTPS API/web checks pass; and the production smoke test passes.

## Android installed-build flows

After installing the EAS internal APK, run the checked-in Maestro flows with real pilot-test values:

```powershell
maestro test -e STAFF_PHONE=03001234567 -e STAFF_NAME="Pilot Lawyer" -e STAFF_EMAIL=pilot@example.com -e FIRM_NAME="Pilot Chambers" -e STAFF_OTP=123456 apps/mobile/maestro/invited-signup.yaml
maestro test -e STAFF_PHONE=03001234567 -e STAFF_OTP=123456 -e MATTER_CASE_NUMBER="W.P. 123/2026" -e HEARING_NOTES="Pilot hearing update" -e NEXT_DATE=2026-07-15 -e CLIENT_UPDATE="Pilot client update" apps/mobile/maestro/hearing-client-update.yaml
```

Use a fresh OTP for each flow. Installed-build execution against the hosted API is required before launch.

## Restore gate

Run the encrypted R2 restore drill in [RESTORE.md](RESTORE.md) against a disposable database. Pilot launch is blocked until the restored row counts and sample records are verified.
