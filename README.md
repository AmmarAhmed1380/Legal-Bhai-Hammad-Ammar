# Legal Bhai

Legal Bhai is an invite-only controlled-pilot legal practice app for solo lawyers in Islamabad and Rawalpindi.

## Local development

```bash
npm install
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Copy `.env.example` into a local `.env`. Development seed accounts are enabled outside production unless `ENABLE_PRODUCT_SEED_DATA=false`.

In development, OTP codes use `WAKEEL_DEV_OTP_CODE` (default `246810` in `.env.example`). Seed logins include lawyer `03001234567` and client `03005550001`.

To wipe and reseed demo data:

```bash
npm run reset:demo
```

Stop the API first if SQLite reports `database is locked`.

## Verification

```bash
npx playwright install chromium
npm run verify
```

With a disposable PostgreSQL database:

```bash
DATABASE_URL=postgresql://... npm run migrate
TEST_DATABASE_URL=postgresql://... npm run test:api
```

Production operators use `npm run smoke:production` through `infra/windows/run-production-smoke.ps1`.

## Pilot scope

- Invited lawyer OTP signup and personal workspace
- Matter/client management and CSV matter import
- IHC cause-list ingestion, exact matching, calendar, and possible conflicts
- Hearing notes and private order/document uploads
- Client portal protected by OTP (all matters linked to the client)
- Database-backed email/SMS reminder worker
- Legal Bhai web app and Android internal build

The original demo API is available only when `ENABLE_DEMO_SURFACES=true`. Production validation rejects demo surfaces and seed data.

See [deployment](Docs/DEPLOYMENT.md) and [restore](Docs/RESTORE.md) before handling real client data.
