# Legal Bhai

Legal Bhai is an invite-only controlled-pilot legal practice app for solo lawyers in Islamabad and Rawalpindi.

## Local development

```bash
npm install
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Copy `.env.example` into your local environment. Development seed accounts are enabled outside production unless `ENABLE_PRODUCT_SEED_DATA=false`.

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

## Let a tester try Legal Bhai

For a safe fake-data test on the same Wi-Fi:

```bash
npm run brother:test
```

For Expo Go Android testing:

```bash
npm run brother:test:mobile
```

See [Brother Testing Guide](Docs/BROTHER_TESTING.md) for accounts, the feature checklist, reset instructions, and remote-testing limits.

## Pilot scope

- Invited lawyer OTP signup and personal workspace
- Matter/client management and CSV matter import
- IHC cause-list ingestion, exact matching, calendar, and possible conflicts
- Hearing notes and private order/document uploads
- One-matter client portal protected by OTP
- Database-backed email/SMS reminder worker
- Legal Bhai web app and Android internal build

The original demo API is available only when `ENABLE_DEMO_SURFACES=true`. Production validation rejects demo surfaces and seed data.

See [pilot readiness](Docs/PILOT_READINESS.md), [acceptance matrix](Docs/PILOT_ACCEPTANCE.md), and [deployment](Docs/DEPLOYMENT.md) before handling real client data.
