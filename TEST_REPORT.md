# LegalBahi Test Report

Date: 2026-06-13

## Final commands run

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | Pass | Run from a fresh clone of the final handoff commit; installed 652 packages, 0 vulnerabilities. |
| `npx playwright install chromium` | Pass | Chromium browser install command completed successfully before E2E verification. |
| `npm run lint` | Pass | Repository hygiene lint passed for 211 unignored files in the clean checkout. |
| `npm run verify` | Pass | Full gate passed in the clean checkout. |
| `npm audit --omit=dev --json` | Pass | 0 production vulnerabilities. |

## Commands covered by `npm run verify`

| Subcommand | Result | Notes |
| --- | --- | --- |
| `npm run test:api` | Pass | 60 tests: 59 pass, 1 skipped. |
| `npm run typecheck:api` | Pass | API TypeScript check passed. |
| `npm run build:web` | Pass | Next production build passed. |
| `npm run test:web:e2e` | Pass | Playwright pilot workflow passed. |
| `npm run typecheck:mobile` | Pass | Mobile TypeScript check passed. |
| `npm run test:mobile:flows` | Pass | 2 LegalBahi Android Maestro flow definitions verified. |
| `npm run test:deployment` | Pass | Windows scripts, Caddy loopback routing, R2 lifecycle, and 6 migrations verified. |

## Skipped test

- `PostgreSQL pilot runtime migrates and isolates workspaces` is skipped unless `TEST_DATABASE_URL` is set.
- `TEST_DATABASE_URL` was absent in this environment during clean-checkout verification, so PostgreSQL integration proof remains an external/local-infra blocker, not an application test failure.

## Handoff packaging validation

- Existing `.git` metadata was removed and the repository was reinitialized.
- A single root commit was created for the handoff source.
- `node_modules`, `.next`, `.expo`, `test-results`, `playwright-report`, runtime SQLite files, upload folders, `.DS_Store`, and empty runtime folders were removed from the source tree before the commit.
- `CLEAN_HANDOFF.md` documents what belongs in a ZIP/GitHub handoff and what must stay out.

## Coverage added

- Court parser tests for LHC Rawalpindi and Rawalpindi District fixtures.
- Court-specific normalization tests.
- Offline fixture-backed Rawalpindi source fetch test.
- Product API test for Rawalpindi District and LHC Rawalpindi sync, exact matching, calendar update, and unmatched manual-review rows.
- Updated Playwright pilot flow for controlled court selection.

## Warnings

- Node emits `node:sqlite` experimental warnings during local tests. Existing test suite behavior; not a failing condition.
