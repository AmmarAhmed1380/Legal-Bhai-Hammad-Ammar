import { existsSync, readFileSync, readdirSync } from "node:fs";

const requiredPowerShell = [
  "backup-postgres.ps1",
  "build-web.ps1",
  "install-backup-task.ps1",
  "install-services.ps1",
  "load-environment.ps1",
  "migrate-postgres.ps1",
  "restore-postgres.ps1",
  "run-production-smoke.ps1",
  "validate-production.ps1",
  "verify-production-host.ps1",
];

for (const name of requiredPowerShell) {
  const path = `infra/windows/${name}`;
  if (!existsSync(path)) {
    throw new Error(`Missing deployment script: ${path}`);
  }
  const firstMeaningfulLine = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (!firstMeaningfulLine?.startsWith("param(")) {
    throw new Error(`${path} must declare param(...) before executable statements`);
  }
}

const services = readFileSync("infra/windows/install-services.ps1", "utf8");
for (const requiredText of [
  'validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy',
  "legalbahi-production-api.txt",
  '$Environment["HOST"] = "127.0.0.1"',
  '$Environment["PORT"] = "3001"',
  '"HOSTNAME" = "127.0.0.1"',
  '"LocalService"',
  "$RuntimeEnvironment",
  "R2_BACKUP_ACCESS_KEY_ID",
  '"R2_DOCUMENT_BUCKET"] -eq $Environment["R2_BACKUP_BUCKET"',
  "Restart-Service -Name $Name -Force",
]) {
  if (!services.includes(requiredText)) {
    throw new Error(`install-services.ps1 is missing: ${requiredText}`);
  }
}

const backupTask = readFileSync("infra/windows/install-backup-task.ps1", "utf8");
for (const requiredText of ['validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root', "R2_BACKUP_ACCESS_KEY_ID"]) {
  if (!backupTask.includes(requiredText)) {
    throw new Error(`install-backup-task.ps1 is missing: ${requiredText}`);
  }
}

const validator = readFileSync("infra/windows/validate-production.ps1", "utf8");
for (const requiredText of [
  "BACKUP_AGE_RECIPIENT",
  "R2_BACKUP_ACCESS_KEY_ID",
  "R2 backup credentials must be separate",
  "TRUST_PROXY_LOOPBACK",
  "NEXT_PUBLIC_API_URL",
  "example.com",
  "must be at least 32 characters in production",
  "Caddyfile does not contain the configured production hosts",
]) {
  if (!validator.includes(requiredText)) {
    throw new Error(`validate-production.ps1 is missing: ${requiredText}`);
  }
}

for (const name of ["migrate-postgres.ps1", "run-production-smoke.ps1"]) {
  const source = readFileSync(`infra/windows/${name}`, "utf8");
  if (!source.includes('validate-production.ps1"')) {
    throw new Error(`${name} must run the shared production validator`);
  }
}

const hostVerifier = readFileSync("infra/windows/verify-production-host.ps1", "utf8");
for (const requiredText of [
  "LegalBahiApi",
  "LegalBahiWorker",
  "LegalBahiWeb",
  "LegalBahi PostgreSQL Backup",
  "Get-NetTCPConnection",
  "NT AUTHORITY\\LocalService",
  "list-objects-v2",
  "run-production-smoke.ps1",
  "legalbahi-production-api.txt",
]) {
  if (!hostVerifier.includes(requiredText)) {
    throw new Error(`verify-production-host.ps1 is missing: ${requiredText}`);
  }
}

const backup = readFileSync("infra/windows/backup-postgres.ps1", "utf8");
for (const requiredText of ["R2_BACKUP_ACCESS_KEY_ID", "R2_BACKUP_SECRET_ACCESS_KEY"]) {
  if (!backup.includes(requiredText)) {
    throw new Error(`backup-postgres.ps1 is missing: ${requiredText}`);
  }
}

const webBuilder = readFileSync("infra/windows/build-web.ps1", "utf8");
for (const requiredText of [
  'validate-production.ps1" -EnvironmentFile $EnvironmentFile -Root $Root -ValidateCaddy',
  "npm --workspace @wakeel/web run build",
  "legalbahi-production-api.txt",
]) {
  if (!webBuilder.includes(requiredText)) {
    throw new Error(`build-web.ps1 is missing: ${requiredText}`);
  }
}

const uptime = readFileSync(".github/workflows/uptime.yml", "utf8");
for (const requiredText of ["LEGALBAHI_API_HEALTH_URL", "LEGALBAHI_WEB_URL", "LegalBahi", "/v1/health/uptime", "UPTIME_SECRET"]) {
  if (!uptime.includes(requiredText)) {
    throw new Error(`uptime.yml is missing: ${requiredText}`);
  }
}

const production = readFileSync(".github/workflows/production.yml", "utf8");
for (const requiredText of ["npm run verify", "npm audit", "branches: [main]", "postgres:17-alpine"]) {
  if (!production.includes(requiredText)) {
    throw new Error(`production.yml is missing: ${requiredText}`);
  }
}

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
for (const requiredText of ["windows-latest", "Parser]::ParseFile", "validate-production.ps1"]) {
  if (!ci.includes(requiredText)) {
    throw new Error(`ci.yml is missing Windows deployment validation: ${requiredText}`);
  }
}

const productionSmoke = readFileSync("apps/api/src/production-smoke.ts", "utf8");
for (const requiredText of [
  "checkErrorReporting",
  "Sentry.captureMessage",
  "Sentry.flush",
  "short-lived portal scope",
  "/v1/clients/me/matters",
]) {
  if (!productionSmoke.includes(requiredText)) {
    throw new Error(`production-smoke.ts is missing: ${requiredText}`);
  }
}

const caddy = readFileSync("infra/windows/Caddyfile", "utf8");
for (const target of ["reverse_proxy 127.0.0.1:3000", "reverse_proxy 127.0.0.1:3001"]) {
  if (!caddy.includes(target)) {
    throw new Error(`Caddyfile is missing loopback target: ${target}`);
  }
}

const lifecycle = JSON.parse(readFileSync("infra/r2/lifecycle.json", "utf8"));
if (lifecycle.rules?.[0]?.prefix !== "postgres/" || lifecycle.rules?.[0]?.expiration?.days !== 30) {
  throw new Error("R2 backup lifecycle must retain postgres/ objects for 30 days");
}

const migrations = readdirSync("infra/postgres/migrations").filter((name) => name.endsWith(".sql")).sort();
for (const requiredMigration of [
  "001_pilot.sql",
  "002_pilot_constraints.sql",
  "003_client_phone_workspace_scope.sql",
  "004_registry_and_notification_templates.sql",
  "005_remove_legacy_pilot_state.sql",
  "006_rawalpindi_court_sources.sql",
]) {
  if (!migrations.includes(requiredMigration)) {
    throw new Error(`Missing pilot migration: ${requiredMigration}`);
  }
}

console.log(`Verified ${requiredPowerShell.length} Windows scripts, Caddy loopback routing, R2 retention, and ${migrations.length} migrations`);
