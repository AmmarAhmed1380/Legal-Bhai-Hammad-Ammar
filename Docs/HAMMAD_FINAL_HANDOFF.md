# Legal Bhai Final Handoff for Hammad

Prepared for: Hammad  
Purpose: Explain what the project is, what already works, what is unfinished, and what Hammad must complete to turn Legal Bhai into a usable Pakistan-focused legal practice product.

## 1. What This Project Is

Legal Bhai is a Pakistan-focused legal practice management product for lawyers.

It is designed mainly for lawyers working around Islamabad and Rawalpindi, with early focus on:

- Islamabad High Court
- Lahore High Court Rawalpindi Bench
- Rawalpindi District & Sessions Courts
- Rawalpindi civil, family, criminal, and magistrate-side practice

This is not just a website. It is a multi-surface product:

1. Lawyer web dashboard
2. Client portal website
3. Android lawyer mobile app
4. Backend API and worker system
5. PostgreSQL database and deployment scripts

The intended user is a lawyer who wants one place to manage cases, hearing dates, clients, documents, court-list updates, and client communication.

## 2. What Problem It Solves

Pakistani lawyers often manage case work through a mix of diary notes, WhatsApp, phone calls, paper files, screenshots, cause lists, and memory. Legal Bhai tries to make that workflow more organized.

The final product should help a lawyer answer these questions quickly:

- What hearings do I have today?
- What hearings are coming tomorrow or this week?
- Which matters have client updates pending?
- Which court dates came from court-source sync and which were entered manually?
- Are there hearing conflicts across different courts?
- Which documents are private and which are visible to the client?
- Can a client safely see their own case update without seeing anything else?
- Has the client given consent for SMS reminders?

The goal is simple: a pilot lawyer should be able to use Legal Bhai as a real legal-work diary and client-update tool.

## 3. Current Product Surfaces

### 3.1 Lawyer Web Dashboard

This is the main working surface for lawyers and staff.

Primary routes:

- `/overview`
- `/product/staff`

The web dashboard already supports:

- Lawyer OTP login
- Invited lawyer signup
- Workspace overview
- Matter list
- Matter creation
- Matter editing
- Matter archiving
- Court selection
- Client creation
- Client linking to matters
- Client unlinking from matters
- Client archive
- Party creation, editing, and deletion
- Hearing update entry
- Manual next-date update
- Calendar view
- Conflict warnings
- Document upload
- Document vault
- Client-visible document toggle
- Client portal link creation
- Client thread/messages
- Court-source sync controls
- Court match review
- Notification preferences
- Notification history
- Active sessions
- Alerts
- Audit stream

The dashboard is currently functional but not fully polished. It is also implemented mostly inside one large file:

- `apps/web/app/product/staff/page.tsx`

That file works, but it is too large for long-term maintenance. Hammad should not start by rewriting it. First, get the product hosted and usable. Refactor later.

### 3.2 Client Portal

Primary routes:

- `/product/client`
- `/c/[token]`

The client portal allows a client to open a protected link and see only the matter shared with them.

Current behavior:

- Client receives or opens a portal link.
- Client must request/enter OTP.
- Raw portal link alone does not expose matter data.
- After OTP, client receives a short-lived portal-scoped token.
- Client sees exactly one linked matter.
- Client can see shared hearing updates.
- Client can see shared documents only if lawyer marked them visible.
- Client cannot access the lawyer workspace.
- Client cannot enumerate other matters.

This is one of the strongest parts of the product from a security/design perspective.

### 3.3 Android Lawyer App

Primary files:

- `apps/mobile/App.tsx`
- `apps/mobile/src/productApp.tsx`

The Android app exists and has Legal Bhai branding.

It currently supports:

- Lawyer OTP login
- Invited-lawyer registration flow
- Secure session storage
- Matter list
- Matter detail
- Calendar summary
- Alerts
- Hearing update
- Camera/gallery image selection
- Hearing-order/photo upload
- Private matter document upload
- Client thread update
- Sign out with server-side session revoke

Current limitation:

- `apps/mobile/App.tsx` still contains the older Wakeel demo app and the newer product app wrapper in the same file.
- Production mode opens the real Legal Bhai product app.
- Demo mode is still available only when demo surfaces are enabled.

This is acceptable for pilot, but Hammad should clean it before commercial launch.

### 3.4 Backend API

Main files:

- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/server.ts`
- `apps/api/src/worker.ts`

The backend is a Fastify API. It handles:

- OTP auth
- Refresh/logout sessions
- Firms/workspaces
- Staff memberships
- Pilot invites
- Matters
- Parties
- Clients
- Client memberships
- Hearings
- Calendar
- Conflicts
- Documents
- Threads/messages
- Time entries
- Invoices
- Court-source sync
- Court match review
- Alerts
- Search
- Reports overview
- Notification preferences
- Notification history
- Portal links
- Portal OTP
- Ingestion runs
- Audit events

The backend has two store implementations:

1. SQLite/local development store
2. PostgreSQL production store

Production is designed to use PostgreSQL only.

### 3.5 Worker System

Main file:

- `apps/api/src/worker.ts`

The worker handles:

- Scheduling pilot notifications
- Claiming due notification jobs
- Sending SMS/email through providers
- Recording delivery attempts
- Running court-source sync cycles
- Recording degraded court-source health on failure

The worker does not use Redis. It uses database-backed jobs.

## 4. What Already Works

The project already has a lot implemented.

### Authentication

Implemented:

- Staff OTP request
- Staff OTP verify
- Client OTP request
- Client OTP verify
- Portal OTP request
- Portal OTP verify
- Refresh tokens
- Logout
- Session listing
- Production config checks
- Demo surfaces disabled in production

### Workspaces

Implemented:

- Invited lawyer can register.
- Registration creates a private solo workspace.
- Staff users belong to firms.
- Cross-workspace access is tested.
- Same client phone can exist in separate firms after migration support.

### Matters

Implemented:

- Create matter
- Edit matter
- Archive/close matter
- List matters
- Fetch matter detail
- Court selection
- Case number normalization
- Matter type/status/stage fields
- CSV import preview
- CSV confirm
- Rejected-row download

### Clients

Implemented:

- Create client
- Edit client
- Archive client
- Link client to matter
- Unlink client from matter
- Client reminder consent/preferences
- Client-specific matter access

### Hearings and Calendar

Implemented:

- Add hearing update
- Hearing outcome
- Hearing notes
- Next date
- Courtroom
- Bench
- Optional document attachment
- Manual next dates sync to calendar
- Conflict detection
- Calendar listing

### Documents

Implemented:

- Upload document from web
- Upload image/document from mobile flow
- Private by default
- Portal visibility toggle
- Document search
- Document download
- R2 storage abstraction
- Signed download URL behavior
- Seed document support for local testing

Important: malware scanning is only a placeholder/hook. It is not a live malware scanning system yet.

### Client Portal

Implemented:

- Create portal link
- Portal link tied to one matter and one client
- OTP required before showing data
- Portal-scoped token
- Client sees only linked matter
- Private documents stay hidden
- Shared documents are visible
- Portal token cannot access full client workspace

### Court Sources

Implemented:

- Generic court-source registry
- Islamabad High Court source
- Lahore High Court Rawalpindi Bench source definition
- Rawalpindi District source definition
- IHC parser
- IHC case-number normalization
- IHC regular/supplementary/urgent list support
- Rawalpindi fixture parsers
- LHC Rawalpindi fixture parser
- Exact-match court matching
- Unmatched-entry manual review
- Calendar update from matched court entries
- Source health/degraded state

Important limitation:

- IHC has a real live fetch path.
- Rawalpindi District and LHC Rawalpindi are currently fixture-backed, not true live production adapters.

### Notifications

Implemented:

- Notification templates
- Notification preferences
- SMS consent records
- Notification jobs
- Notification attempts
- Retry/failure recording
- Twilio SMS provider
- Resend email provider
- Development mock providers
- Lawyer next-day agenda logic
- Client hearing reminder logic
- Post-hearing update logic

Important:

- Real Twilio and Resend delivery still need hosted staging/production validation.

### Deployment and Ops

Implemented:

- PostgreSQL migrations
- Windows VPS scripts
- Caddy config
- Service install scripts
- Production validation scripts
- Backup scripts
- Restore scripts
- R2 lifecycle config
- Production smoke command
- GitHub CI workflow
- Uptime workflow
- Android EAS config
- Mobile flow validation

Important:

- These are repository-proven, not fully production-proven.
- Real VPS/domain/provider validation is still required.

## 5. Current Verification Status

Current local status:

- `npm run lint`: passes
- `npm run verify`: passes
- API tests: 60 total, 59 pass, 1 skipped
- API typecheck: passes
- Web build: passes
- Playwright pilot workflow: passes
- Mobile typecheck: passes
- Mobile flow validation: passes
- Deployment asset validation: passes

Skipped test:

- PostgreSQL pilot runtime test is skipped unless `TEST_DATABASE_URL` is set.

Current issue:

- `npm audit --omit=dev` currently fails.

Audit findings:

- `@babel/core <= 7.29.0`: low severity
- `ws 7.0.0 - 7.5.10`: high severity

These come through the Expo/React Native mobile tooling dependency tree.

Hammad should fix this before claiming the repo is audit-clean.

## 6. What Is Not Finished Yet

The codebase is strong, but the product is not ready for real client use until these are done.

### 6.1 Real Hosting

Not completed.

Needed:

- Production/staging server
- Domain
- HTTPS
- PostgreSQL
- Caddy or equivalent reverse proxy
- API service
- Worker service
- Web service
- Firewall rules
- Service monitoring

The deployment docs currently assume a Windows VPS path.

### 6.2 Real OTP and Email

Not proven.

Needed:

- Twilio account
- Twilio sender
- Test lawyer number
- Test client number
- Resend account
- Verified sending domain/email
- Successful real OTP smoke test
- Successful email smoke test

### 6.3 Real R2 Storage

Not proven.

Needed:

- Cloudflare R2 document bucket
- Separate R2 backup bucket
- Separate credentials for documents and backups
- Upload/download smoke test
- Signed download test
- Backup upload test
- Restore drill

### 6.4 Real Sentry/Uptime

Not proven.

Needed:

- Sentry DSN
- Production smoke event
- Uptime health URL secrets
- GitHub Actions secrets
- Hosted health checks

### 6.5 Rawalpindi/LHC Live Court Sources

Partially implemented.

Current state:

- IHC can fetch live.
- Rawalpindi District and LHC Rawalpindi use checked-in fixture files.

Decision needed:

Option A: Launch V1 with IHC live and Rawalpindi manual/ops-assisted review.  
Option B: Build true live adapters for Rawalpindi and LHC Rawalpindi before launch.

Option A is faster and safer. Option B is more complete but takes longer and may break if official court sites change.

### 6.6 Android Installed Build

Not fully proven.

Current state:

- Mobile app typechecks.
- Flow definitions validate.
- Export/build path has been tested locally.

Still needed:

- EAS cloud/internal build
- Install on real Android phone
- Test against hosted API
- Test real OTP
- Test hearing photo upload
- Test document upload
- Test sign-out/session revoke

### 6.7 Final UX Polish

Needed before serious lawyer use:

- Simplify navigation.
- Make the first dashboard screen more lawyer-friendly.
- Confirm terminology with the pilot lawyer/user.
- Confirm court names and stages.
- Confirm what clients should and should not see.
- Make mobile app focus on actual field use.
- Clean old Wakeel/demo references from visible production surfaces.

## 7. What Hammad Must Validate With a Pilot Lawyer

Hammad should not treat this only as an infrastructure project. He must validate whether the legal workflow makes sense to an actual Pakistani lawyer.

Hammad should collect answers to these workflow questions:

1. Is the matter form correct for Pakistani practice?
2. Are the court names correct?
3. Are the case number examples realistic?
4. Are stages useful or should they be changed?
5. Does the hearing update form capture enough information?
6. Should hearing outcome be free text or controlled options?
7. What should appear on the dashboard every morning?
8. Is the calendar view enough?
9. Are conflict warnings useful?
10. Should client reminders be automatic or lawyer-approved?
11. What documents should be shareable with clients?
12. Should clients be able to send messages back?
13. Is the client portal too simple or enough?
14. Should Urdu be improved or kept minimal for V1?
15. Would a lawyer trust this UI with real cases?

All user validation should happen with fake or pilot-safe data first.

The local test guide is:

- `Docs/BROTHER_TESTING.md`

## 8. Recommended Hammad Work Plan

### Phase 1: Stabilize the Handoff

Goal: Make sure the repo Hammad receives is truthful and clean.

Tasks:

1. Run `npm ci`.
2. Run `npm run lint`.
3. Run `npm run verify`.
4. Run `npm audit --omit=dev`.
5. Fix audit findings.
6. Rerun all checks.
7. Update stale docs that still claim audit is clean.

Expected output:

- Clean local verification.
- Clean production audit.
- Updated handoff notes.

### Phase 2: Prove PostgreSQL

Goal: Prove the real production database path.

Tasks:

1. Create disposable PostgreSQL database.
2. Set `TEST_DATABASE_URL`.
3. Run `TEST_DATABASE_URL=postgresql://... npm run test:api`.
4. Run migrations twice and confirm idempotency.
5. Confirm workspace isolation works in PostgreSQL.

Expected output:

- No skipped PostgreSQL test.
- Migration proof recorded.

### Phase 3: Create Staging Environment

Goal: Make a hosted version that can be tested by Zohaib, Hammad, and the pilot lawyer.

Tasks:

1. Provision server.
2. Configure API domain.
3. Configure web domain.
4. Configure PostgreSQL.
5. Configure CORS.
6. Configure JWT secret.
7. Configure pilot admin secret.
8. Disable demo surfaces.
9. Disable seed data for production/staging if using real data.
10. Configure service startup.
11. Run health checks.

Expected output:

- Hosted web app.
- Hosted API.
- Hosted database.
- No local-only dependencies.

### Phase 4: Connect Providers

Goal: Test real-world services.

Tasks:

1. Connect Twilio.
2. Connect Resend.
3. Connect Cloudflare R2.
4. Connect Sentry.
5. Run `npm run smoke:production` or the Windows wrapper.
6. Confirm real staff OTP.
7. Confirm real client portal OTP.
8. Confirm email send.
9. Confirm SMS send.
10. Confirm R2 upload/download/delete.
11. Confirm Sentry event.

Expected output:

- Real provider smoke passes.

### Phase 5: Court-Source Decision

Goal: Decide what court automation means in V1.

Tasks:

1. Keep IHC live source.
2. Decide whether Rawalpindi/LHC launch as fixture/manual/ops-assisted or live automation.
3. If live automation is required, build adapters.
4. Add tests for live adapter parsing.
5. Make failures degrade safely.
6. Never silently change calendar dates without clear source/confidence.

Recommended V1:

- IHC live.
- Rawalpindi/LHC as manual or ops-assisted until live adapters are proven.

### Phase 6: Android Internal Build

Goal: Put the app on a real phone.

Tasks:

1. Set `EXPO_PUBLIC_API_URL` to hosted API.
2. Build Android internal APK/AAB.
3. Install on real Android device.
4. Test invited signup.
5. Test existing lawyer login.
6. Test matter list.
7. Test hearing update.
8. Test camera upload.
9. Test document upload.
10. Test client thread.
11. Test sign out.

Expected output:

- Pilot users can test the actual mobile app against the hosted API.

### Phase 7: Pilot-Lawyer Feedback Loop

Goal: Convert pilot-lawyer feedback into final product decisions.

Tasks:

1. Give the pilot lawyer fake-data staging access.
2. Ask the pilot lawyer to test the daily workflow.
3. Record confusing screens.
4. Record missing fields.
5. Record wrong legal terminology.
6. Record any privacy concerns.
7. Prioritize changes.
8. Implement only the changes needed for pilot.

Expected output:

- Pilot-lawyer-approved V1 workflow.

### Phase 8: Launch Gate

Do not use real client data until all of these pass:

- Hosted HTTPS web and API
- Production database
- Real OTP
- Real email
- Real R2 storage
- Real backup and restore
- Real Android installed-build test
- Production smoke test
- Sentry event
- Uptime checks
- Demo surfaces disabled
- Seed data disabled
- Access-control tests pass
- Pilot lawyer accepts workflow

## 9. Suggested Final Product Shape

The finished product should feel like this:

### Lawyer Opens Dashboard

He sees:

- Today's hearings
- Tomorrow's hearings
- Open matters
- Court sync health
- Conflicts
- Client updates waiting
- Recent documents
- Unmatched court entries needing review

### Lawyer Opens Matter

He sees:

- Court
- Case number
- Parties
- Stage
- Status
- Next date
- Hearing history
- Uploaded documents
- Client access
- Client thread
- Court-source match history

### Lawyer Leaves Court

He can:

- Open mobile app
- Select matter
- Add hearing outcome
- Add notes
- Add next date
- Take/upload order photo
- Send client update
- Trigger reminder logic

### Client Opens Link

Client can:

- Verify OTP
- See only their own matter
- See next hearing date
- Read latest lawyer update
- Download shared documents
- Send/read thread messages if enabled

The client should never see:

- Other cases
- Other clients
- Private documents
- Internal lawyer notes
- Firm dashboard
- Audit logs
- Billing/admin data unless explicitly built later

## 10. Main Technical Risks

### Risk 1: Court websites change

Court-source automation can break if official sites change markup or behavior.

Mitigation:

- Treat court data as informational.
- Show source/confidence.
- Require manual review for uncertain matches.
- Fail into degraded state.
- Do not corrupt calendar data on provider failure.

### Risk 2: Wrong client data exposure

This is the biggest legal-tech risk.

Mitigation already present:

- Portal scoped to one matter.
- Portal OTP required.
- Portal token cannot access full client workspace.
- Private documents hidden.
- Cross-workspace tests exist.

Hammad must preserve these controls.

### Risk 3: Real SMS/email not tested

Local mocks are not enough.

Mitigation:

- Run real Twilio/Resend smoke.
- Record delivery IDs.
- Check notification history.

### Risk 4: Storage security

Legal documents are sensitive.

Mitigation:

- Use private R2 bucket.
- Use signed URLs.
- Use separate backup bucket and credentials.
- Add malware scanning later.

### Risk 5: Large files slow future changes

Some files are too large.

Examples:

- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/product-api.ts`
- `apps/web/app/product/staff/page.tsx`

Mitigation:

- Do not refactor before launch unless needed.
- After pilot works, split into smaller modules.

## 11. Files Hammad Should Read First

Start with:

- `README.md`
- `CLEAN_HANDOFF.md`
- `Docs/BROTHER_TESTING.md`
- `Docs/PILOT_COMPLETION_AUDIT.md`
- `Docs/PILOT_ACCEPTANCE.md`
- `Docs/DEPLOYMENT.md`
- `Docs/RESTORE.md`
- `TEST_REPORT.md`
- `SECURITY_NOTES.md`
- `DEPLOYMENT_READY.md`
- `PILOT_ACCEPTANCE_REPORT.md`

Then inspect:

- `package.json`
- `.env.example`
- `apps/api/src/lib/product-api.ts`
- `apps/api/src/lib/product-store.ts`
- `apps/api/src/lib/postgres-product-store.ts`
- `apps/api/src/lib/court-sources.ts`
- `apps/api/src/lib/ihc.ts`
- `apps/api/src/worker.ts`
- `apps/web/app/product/staff/page.tsx`
- `apps/web/app/product/client/page.tsx`
- `apps/mobile/src/productApp.tsx`
- `apps/mobile/App.tsx`
- `infra/postgres/migrations/`
- `infra/windows/`

## 12. Commands Hammad Should Run

Fresh install:

```bash
npm ci
```

Main verification:

```bash
npm run lint
npm run verify
npm audit --omit=dev
```

PostgreSQL verification:

```bash
TEST_DATABASE_URL=postgresql://... npm run test:api
```

Local fake-data web test:

```bash
npm run brother:test
```

Mobile local fake-data test:

```bash
npm run brother:test:mobile
```

Reset fake test data:

```bash
npm run brother:test:reset
```

Production smoke after hosted env is configured:

```bash
npm run smoke:production
```

## 13. Four-Day Delivery Target

The immediate target is not a fully polished commercial product. The target is a usable hosted pilot that a lawyer can test end-to-end with fake or pilot-safe data within 4 days.

Current practical status:

- Local fake-data product is mostly ready.
- Core web/API/mobile workflows already exist.
- The remaining 4-day work is deployment, provider setup, verification, and pilot polish.
- Commercial polish, advanced billing, team management, and full Rawalpindi/LHC live automation should not block the 4-day pilot target.

### Day 1: Stabilize and Verify

Tasks:

1. Run `npm ci`.
2. Fix the current `npm audit --omit=dev` issues.
3. Run `npm run lint`.
4. Run `npm run verify`.
5. Run PostgreSQL tests with `TEST_DATABASE_URL`.
6. Update stale docs that still claim the audit is clean.

Exit condition:

- Local verification is clean.
- PostgreSQL path is proven or the blocker is written down clearly.

### Day 2: Hosted Staging

Tasks:

1. Provision the staging host.
2. Configure API and web domains or temporary HTTPS URLs.
3. Configure PostgreSQL.
4. Configure production-like environment variables.
5. Disable demo surfaces where needed.
6. Deploy API, worker, and web.
7. Confirm `/health` and `/health/ready`.

Exit condition:

- Legal Bhai opens from a hosted URL.
- API and web talk to the hosted database.

### Day 3: Providers and Mobile

Tasks:

1. Configure Twilio.
2. Configure Resend.
3. Configure Cloudflare R2.
4. Configure Sentry.
5. Run production smoke or equivalent staging smoke.
6. Set Android API URL.
7. Build/install Android internal test build or run Expo against hosted API.

Exit condition:

- Real or staging OTP path is tested.
- Document storage path is tested.
- Mobile can reach the hosted API.

### Day 4: Pilot Workflow Lock

Tasks:

1. Test lawyer signup/login.
2. Test matter creation.
3. Test client creation and matter linking.
4. Test hearing update and next date.
5. Test document upload and portal visibility.
6. Test protected client portal OTP.
7. Test client sees exactly one matter.
8. Test IHC sync path or mark court-source limitation clearly.
9. Record remaining pilot blockers.

Exit condition:

- A pilot lawyer can test the full Legal Bhai workflow on hosted web and Android using fake or pilot-safe data.
- Any unfinished item is documented as a launch blocker or post-pilot task.

## 14. What Hammad Should Not Do First

Do not start with:

- Full UI rewrite
- Full backend rewrite
- Renaming every Wakeel package/file
- Adding billing before the legal workflow is proven
- Adding team/admin complexity before the pilot lawyer approves the core flow
- Using real client data before production smoke passes
- Scraping court sites aggressively without safe failure handling

The product already has a working foundation. The first goal is to make it stable, hosted, testable, and legally useful.

## 15. Recommended Immediate Next Step

Hammad's 4-day execution plan should be:

1. Run the repo locally.
2. Fix `npm audit`.
3. Run full verify.
4. Run PostgreSQL tests with `TEST_DATABASE_URL`.
5. Create hosted staging.
6. Give Zohaib, Hammad, and the pilot lawyer fake-data access.
7. Watch the pilot lawyer use the app.
8. Record workflow feedback.
9. Fix only the pilot-critical issues.

The success condition is not "all features are perfect." The success condition is:

> A pilot lawyer can use Legal Bhai on web and Android with fake or pilot data, manage real-looking matters, update hearings, share a protected client portal link, and trust that private client data does not leak.
