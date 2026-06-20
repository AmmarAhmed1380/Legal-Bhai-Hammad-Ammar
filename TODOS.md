# TODOS.md — LegalBahi Project Pipeline

This project board tracks features, infrastructure milestones, and review pipeline tasks prioritized by gstack methodology.

## P0: Core Security, Providers, and OTP Validation
- [x] **Twilio & Resend Integration**: Verified real email delivery via Resend. Twilio credentials verified (hit 50 daily SMS test limit).
  - **Component**: `apps/api/src/lib/providers.ts`
  - **Priority**: P0
- [x] **Cloudflare R2 Private Storage**: Connected to Cloudflare R2 bucket.
  - **Component**: `apps/api/src/lib/storage.ts`
  - **Priority**: P0
- [ ] **PostgreSQL Proof of Runtime**: Deploy and run migrations on PostgreSQL and execute API test suites with `TEST_DATABASE_URL` configured.
  - **Component**: `infra/postgres`
  - **Priority**: P0

## P1: Mobile App Cloud Build & Verification
- [ ] **EAS Build**: Configure `EXPO_PUBLIC_API_URL` to point to the staging URL and build the Android lawyer APK.
  - **Component**: `apps/mobile`
  - **Priority**: P1
- [ ] **Mobile Flow Verification**: Install the APK on a test device and perform verification for login, case creation, and order photo uploads.
  - **Component**: `apps/mobile`
  - **Priority**: P1

## P2: Staging Server & Real Hosting Setup
- [ ] **Server Provisioning & Caddy Setup**: Configure staging reverse proxy with Caddy and map SSL/HTTPS certificates.
  - **Component**: `infra/windows`
  - **Priority**: P2
- [ ] **Staging Deploy & Health Checks**: Deploy the API, worker, and web services, verifying `/health` and `/health/ready` endpoints.
  - **Component**: `infra/windows`
  - **Priority**: P2

## P3: Security Audit & Dependency Patches
- [x] **NPM Vulnerability Auditing**: Identified 18 moderate vulnerabilities in React Native tree (`js-yaml`, `postcss`, `uuid`). Accepted risk for pilot launch to avoid breaking changes.
  - **Component**: Root workspace package tree
  - **Priority**: P3

## P4: Lahore High Court Scraper Expansion (Post-Pilot)
- [ ] **LHC Rawalpindi Live Parser**: Upgrade LHC Rawalpindi bench adapter from offline fixtures to live page parsing.
  - **Component**: `apps/api/src/lib/court-sources.ts`
  - **Priority**: P4
- [ ] **Rawalpindi District Live Parser**: Build and test live page parsing for Rawalpindi District Courts.
  - **Component**: `apps/api/src/lib/court-sources.ts`
  - **Priority**: P4

---

## Completed Tasks
- [x] **Redundant Registration Form Button**: Removed "Back to Sign In" button from Lawyer register view.
- [x] **Primary City Input Defaults**: Default value set to empty string (`""`) and validate required fields.
- [x] **Matter Edit Form Validations**: Mandatory fields checks and strict format check for Case Number formats.
- [x] **Lawyer Role client OTP bypass**: Removed checks blocking lawyer phone number from requesting client portal OTP.
- [x] **Clean DB Client Migration**: Migrated all case data to single client account `MRM` (`+16012109282`) and deleted other demo clients.
- [x] **Court Health Visual Polish**: Simplify layout to Court Name, status badge, and sync time. Increased background/border color opacity.
- [x] **Overview Panel Names**: Renamed `Matter Stages` to `Matters`.
- [x] **Overview Empty States**: Alerts, Matters, and Client Threads display `"Nothing present"`.
