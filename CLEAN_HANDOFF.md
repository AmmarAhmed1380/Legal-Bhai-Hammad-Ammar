# LegalBahi Clean Handoff Checklist

Use this file before creating a ZIP or pushing to GitHub.

## Include

- Source files under `apps/`, `packages/`, `infra/`, `scripts/`, `.github/`, and docs.
- `package.json` and `package-lock.json`.
- `.env.example` only.
- `PLANS.md`, `SUMMARY.md`, `TEST_REPORT.md`, `SECURITY_NOTES.md`, `DEPLOYMENT_READY.md`, and `PILOT_ACCEPTANCE_REPORT.md`.
- Test fixtures under `apps/api/test/fixtures/`.
- Windows deployment scripts under `infra/windows/`.
- PostgreSQL migrations under `infra/postgres/migrations/`.

## Do not include

- `.git/` in a handoff ZIP. GitHub receives history through Git; a ZIP should contain only the source tree.
- `node_modules/`.
- `.next/`, `dist/`, `coverage/`, `.turbo/`, `.vercel/`, `.expo/`, Playwright reports, or test result folders.
- Runtime SQLite databases such as `data/*.sqlite` or `apps/api/data/*.sqlite`.
- Upload/runtime folders such as `data/uploads/`, `data/product-uploads/`, `data/brother-test-uploads/`, `apps/api/data/uploads/`, and `apps/api/data/runtime/`.
- Logs, `.DS_Store`, `__MACOSX`, archives, APK/AAB builds, local env files, private keys, or backup dumps.

## Verification before handoff

From a fresh clone of the final commit:

```bash
npm ci
npx playwright install chromium
npm run lint
npm run verify
npm audit --omit=dev --json
```

If PostgreSQL is available, also set `TEST_DATABASE_URL` and run:

```bash
TEST_DATABASE_URL=postgresql://... npm run test:api
```

The repository is not production-launch complete until the external checks in `DEPLOYMENT_READY.md` and `PILOT_ACCEPTANCE_REPORT.md` are completed.
