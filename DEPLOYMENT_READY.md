# Legal Bhai Deployment Ready Notes

Date: 2026-06-13

## Staging validation status

The local readiness gate was rerun on 2026-06-13 local shell date:

```bash
npm ci
npx playwright install chromium
npm run lint
npm run verify
npm audit --omit=dev --json
```

All five local commands passed. Mobile Android export also passed with a placeholder HTTPS API URL to prove the local export path:

```bash
EXPO_PUBLIC_API_URL=https://staging-api.example.invalid EXPO_PUBLIC_ENABLE_DEMO_SURFACES=false npm --workspace @wakeel/mobile exec expo export -- --platform android --output-dir /tmp/legalbahi-mobile-export
```

Real staging validation is still blocked because no staging env file path or exported staging variables were available. `.env.staging` was not created with placeholders, and no secrets were printed. The existing `npm run smoke:production` command fails closed before network activity when those variables are missing.

Required staging inputs before the external smoke can be completed:

- Absolute path to the staging env file outside the repo.
- `TEST_DATABASE_URL`.
- Staging `DATABASE_URL`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `EXPO_PUBLIC_API_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PILOT_ADMIN_SECRET`, `TRUST_PROXY_LOOPBACK=true`, `IHC_SYNC_ENABLED=true`, and `IHC_SYNC_INTERVAL_MINUTES`.
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`.
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_DOCUMENT_BUCKET`, `R2_BACKUP_BUCKET`, backup credentials, and `BACKUP_AGE_RECIPIENT`.
- Sentry: `SENTRY_DSN`.
- Smoke data: `SMOKE_SMS_TO`, `SMOKE_EMAIL_TO`, `SMOKE_STAFF_PHONE`, `SMOKE_PORTAL_TOKEN`, and manual OTP codes when prompted.

Court-source note: IHC has a live fetch path when enabled. Rawalpindi District/lower courts and LHC Rawalpindi Bench are currently fixture-backed sources, so live validation for those two courts requires a new live adapter or manual import validation.

## Local readiness

From a clean checkout:

```bash
npm ci
npx playwright install chromium
npm run lint
npm run verify
```

The final local run passed after a clean `npm ci` and Chromium browser install for Playwright.

## Production deployment outline

1. Provision a dedicated Windows VPS with Node.js 22, PostgreSQL, Caddy, NSSM, `age`, PostgreSQL client tools, and AWS CLI.
2. Point permanent `app.<domain>` and `api.<domain>` DNS records to the VPS.
3. Copy `.env.example` to the VPS production env file and replace all placeholders.
4. Set `ENABLE_DEMO_SURFACES=false` and `ENABLE_PRODUCT_SEED_DATA=false`.
5. Build web with the production API URL using `infra/windows/build-web.ps1`.
6. Run PostgreSQL migrations twice using `infra/windows/migrate-postgres.ps1`; the second run must be idempotent.
7. Install API, worker, and web services with `infra/windows/install-services.ps1`.
8. Configure Caddy HTTPS loopback proxy.
9. Install encrypted backup task with `infra/windows/install-backup-task.ps1`.
10. Run `infra/windows/run-production-smoke.ps1`.
11. Run `infra/windows/verify-production-host.ps1 -RunSmoke`.
12. Build and install the Android internal APK with `EXPO_PUBLIC_API_URL=https://api.<domain>`.

## Production environment variables

Required:

- `NODE_ENV=production`
- `HOST`
- `PORT`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `PUBLIC_API_URL`
- `PUBLIC_WEB_URL`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL`
- `PILOT_ADMIN_SECRET`
- `TRUST_PROXY_LOOPBACK=true`
- `IHC_SYNC_ENABLED=true`
- `IHC_SYNC_INTERVAL_MINUTES`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_DOCUMENT_BUCKET`
- `R2_BACKUP_BUCKET`
- `R2_BACKUP_ACCESS_KEY_ID`
- `R2_BACKUP_SECRET_ACCESS_KEY`
- `BACKUP_AGE_RECIPIENT`
- `BACKUP_AGE_IDENTITY`
- `SENTRY_DSN`

Optional / environment-specific:

- `COURT_SYNC_ENABLED`
- `COURT_SYNC_INTERVAL_MINUTES`
- `USE_POSTGRES_PRODUCT_STORE`
- `POSTGRES_SSL`
- `POSTGRES_POOL_SIZE`
- `POSTGRES_STATEMENT_TIMEOUT_MS`
- `POSTGRES_OPTIONS`
- `PRODUCT_UPLOADS_DIRECTORY`
- `GOOGLE_CLOUD_VISION_API_KEY`
- `WAKEEL_DEV_OTP_CODE`
- `EXPO_PUBLIC_ENABLE_DEMO_SURFACES=false`
- `NEXT_PUBLIC_ENABLE_DEMO_SURFACES=false`

## External blockers before launch

- Real VPS, DNS, and HTTPS.
- Production PostgreSQL database.
- Twilio live OTP/SMS validation.
- Resend live email validation.
- R2 upload/download validation.
- Sentry event validation.
- Real court-source sync smoke for IHC, LHC Rawalpindi Bench, and Rawalpindi District.
- Encrypted backup restore drill from R2 into a disposable database.
- Android internal APK installed and tested on a real device.
