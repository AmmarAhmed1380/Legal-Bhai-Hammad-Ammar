import { join } from "node:path";
import { existsSync } from "node:fs";

// Load .env files programmatically in non-production environments unless running tests
const isRunningTests =
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test") ||
  process.argv.some((arg) => arg.includes("test")) ||
  Boolean(process.env.WAKEEL_TESTING);

if (!isRunningTests && !isProduction()) {
  const possiblePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "apps/api", ".env"),
    join(process.cwd(), "../..", ".env"),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        // Ignore errors
      }
    }
  }
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const PLACEHOLDER_SECRET = /replace|change.?me|example|password|secret-at-least/i;
const PLACEHOLDER_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "legalbahi.example.com", "api.legalbahi.example.com"]);

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Production-like investor demo: real Postgres/R2, placeholder OTP, no Twilio SMS. */
export function isInvestorStaging(): boolean {
  return isProduction() && envFlag("INVESTOR_STAGING");
}

export function isOtpMockMode(): boolean {
  return !isProduction() || isInvestorStaging();
}

export function shouldExposeDevOtpCode(): boolean {
  return !isProduction() || isInvestorStaging();
}

export function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  return value === undefined ? defaultValue : TRUE_VALUES.has(value.toLowerCase());
}

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) {
    return configured;
  }
  if (isProduction()) {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "legalbahi-development-only-secret";
}

function productionOrigin(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS origin`);
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an absolute HTTPS origin`);
  }
  if (
    PLACEHOLDER_HOSTS.has(hostname) ||
    hostname.endsWith(".example") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".example.com")
  ) {
    throw new Error(`${name} must use a permanent production hostname`);
  }
  return url;
}

export function validateProductionEnvironment(): void {
  if (!isProduction()) {
    return;
  }

  const investorStaging = isInvestorStaging();

  const required = [
    "JWT_SECRET",
    "CORS_ORIGINS",
    "DATABASE_URL",
    "PUBLIC_API_URL",
    "PUBLIC_WEB_URL",
    "PILOT_ADMIN_SECRET",
    ...(investorStaging ? [] : ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"]),
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_DOCUMENT_BUCKET",
    "R2_BACKUP_BUCKET",
    "BACKUP_AGE_RECIPIENT",
    "SENTRY_DSN",
    "IHC_SYNC_ENABLED",
    "TRUST_PROXY_LOOPBACK",
    "UPTIME_SECRET",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
  for (const name of ["JWT_SECRET", "PILOT_ADMIN_SECRET", "UPTIME_SECRET"] as const) {
    const value = process.env[name]!;
    if (value.length < 32) {
      throw new Error(`${name} must be at least 32 characters in production`);
    }
    if (PLACEHOLDER_SECRET.test(value)) {
      throw new Error(`${name} still contains a placeholder value`);
    }
  }
  if (process.env.R2_DOCUMENT_BUCKET === process.env.R2_BACKUP_BUCKET) {
    throw new Error("Documents and PostgreSQL backups must use separate R2 buckets in production");
  }
  if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL!)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }
  if (!/^age1[0-9a-z]+$/.test(process.env.BACKUP_AGE_RECIPIENT!)) {
    throw new Error("BACKUP_AGE_RECIPIENT must be an age X25519 recipient");
  }
  if (!investorStaging) {
    if (!/^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_SMS_FROM!)) {
      throw new Error("TWILIO_SMS_FROM must be an E.164 phone number");
    }
  } else if (!process.env.WAKEEL_DEV_OTP_CODE?.trim()) {
    throw new Error("WAKEEL_DEV_OTP_CODE must be set when INVESTOR_STAGING=true");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.RESEND_FROM_EMAIL!)) {
    throw new Error("RESEND_FROM_EMAIL must be a valid email address");
  }
  const apiUrl = productionOrigin("PUBLIC_API_URL", process.env.PUBLIC_API_URL!);
  const webUrl = productionOrigin("PUBLIC_WEB_URL", process.env.PUBLIC_WEB_URL!);
  if (apiUrl.hostname === webUrl.hostname) {
    throw new Error("PUBLIC_API_URL and PUBLIC_WEB_URL must use separate hostnames");
  }
  if (process.env.NEXT_PUBLIC_API_URL && productionOrigin("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL).origin !== apiUrl.origin) {
    throw new Error("NEXT_PUBLIC_API_URL must match PUBLIC_API_URL");
  }
  const corsOrigins = process.env.CORS_ORIGINS!.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.some((origin) => productionOrigin("CORS_ORIGINS", origin).origin !== origin)) {
    throw new Error("CORS_ORIGINS must contain only absolute HTTPS origins in production");
  }
  if (!corsOrigins.includes(webUrl.origin)) {
    throw new Error("CORS_ORIGINS must include PUBLIC_WEB_URL");
  }
  try {
    const sentry = new URL(process.env.SENTRY_DSN!);
    if (sentry.protocol !== "https:" || PLACEHOLDER_HOSTS.has(sentry.hostname.toLowerCase())) {
      throw new Error();
    }
  } catch {
    throw new Error("SENTRY_DSN must be a production HTTPS DSN");
  }
  if (envFlag("ENABLE_PRODUCT_SEED_DATA")) {
    throw new Error("ENABLE_PRODUCT_SEED_DATA cannot be enabled in production");
  }
  if (envFlag("ENABLE_DEMO_SURFACES")) {
    throw new Error("ENABLE_DEMO_SURFACES cannot be enabled in production");
  }
  if (!envFlag("IHC_SYNC_ENABLED")) {
    throw new Error("IHC_SYNC_ENABLED must be enabled in production");
  }
  if (!envFlag("TRUST_PROXY_LOOPBACK")) {
    throw new Error("TRUST_PROXY_LOOPBACK must be enabled in production");
  }
  if (!investorStaging) {
    const malwareProvider = process.env.MALWARE_SCAN_PROVIDER?.trim().toLowerCase();
    if (!malwareProvider || !["clamav", "cloudmersive", "virustotal"].includes(malwareProvider)) {
      throw new Error("MALWARE_SCAN_PROVIDER must be clamav, cloudmersive, or virustotal in production");
    }
    if (malwareProvider === "cloudmersive" && !process.env.CLOUDMERSIVE_API_KEY?.trim()) {
      throw new Error("CLOUDMERSIVE_API_KEY must be set when MALWARE_SCAN_PROVIDER=cloudmersive");
    }
    if (malwareProvider === "virustotal" && !process.env.VIRUSTOTAL_API_KEY?.trim()) {
      throw new Error("VIRUSTOTAL_API_KEY must be set when MALWARE_SCAN_PROVIDER=virustotal");
    }
  }
  const ihcInterval = Number(process.env.IHC_SYNC_INTERVAL_MINUTES ?? 60);
  if (!Number.isInteger(ihcInterval) || ihcInterval < 5 || ihcInterval > 1440) {
    throw new Error("IHC_SYNC_INTERVAL_MINUTES must be between 5 and 1440");
  }
}
