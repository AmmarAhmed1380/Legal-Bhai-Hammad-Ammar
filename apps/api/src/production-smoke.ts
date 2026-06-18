import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as Sentry from "@sentry/node";

import { validateProductionEnvironment } from "./lib/config.js";
import { createEmailProvider, createSmsProvider } from "./lib/providers.js";
import { createPrivateObjectStorage } from "./lib/storage.js";

interface JsonResponse {
  [key: string]: unknown;
}

const apiUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
const webUrl = process.env.PUBLIC_WEB_URL?.replace(/\/$/, "");

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the production smoke test`);
  }
  return value;
}

function requireHttps(name: string, value: string | undefined): string {
  if (!value?.startsWith("https://")) {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return value;
}

async function requestJson(
  url: string,
  options: RequestInit = {},
  expectedStatus = 200,
): Promise<JsonResponse> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? "GET"} ${url} returned ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<JsonResponse>;
}

async function readOtp(environmentName: string, prompt: string): Promise<string> {
  const configured = process.env[environmentName]?.trim();
  if (configured) {
    return configured;
  }
  if (!input.isTTY) {
    throw new Error(`${environmentName} is required when the smoke test is not interactive`);
  }
  const terminal = createInterface({ input, output });
  try {
    return (await terminal.question(prompt)).trim();
  } finally {
    terminal.close();
  }
}

async function checkPublicSurfaces(apiBaseUrl: string, webBaseUrl: string): Promise<void> {
  const health = await requestJson(`${apiBaseUrl}/health`);
  const ready = await requestJson(`${apiBaseUrl}/health/ready`);
  if (health.ok !== true || ready.ok !== true) {
    throw new Error("API health endpoints did not report ready");
  }
  const webResponse = await fetch(webBaseUrl);
  const webBody = await webResponse.text();
  if (!webResponse.ok || !webBody.includes("Legal Bhai")) {
    throw new Error(`Web app smoke check failed with status ${webResponse.status}`);
  }
  await requestJson(`${apiBaseUrl}/auth/demo/verify`, { method: "POST", body: JSON.stringify({}) }, 404);
  await requestJson(`${apiBaseUrl}/v1/invoices`, {}, 404);
  console.log("PASS HTTPS API/web readiness and production route guards");
}

async function checkR2(): Promise<void> {
  const marker = Buffer.from(`Legal Bhai R2 smoke ${new Date().toISOString()}`);
  const storage = createPrivateObjectStorage();
  const storageKey = await storage.put({ fileName: "production-smoke.txt", bytes: marker, contentType: "text/plain" });
  if (!storageKey.startsWith("r2:")) {
    throw new Error("Production object storage did not return an R2 key");
  }
  try {
    const signedUrl = await storage.signedDownloadUrl(storageKey);
    if (!signedUrl) {
      throw new Error("R2 did not create a signed download URL");
    }
    const response = await fetch(signedUrl);
    if (!response.ok || Buffer.compare(Buffer.from(await response.arrayBuffer()), marker) !== 0) {
      throw new Error("R2 signed download did not return the uploaded bytes");
    }
  } finally {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_DOCUMENT_BUCKET,
      Key: storageKey.slice(3),
    }));
    client.destroy();
  }
  console.log("PASS private R2 upload, signed download, and cleanup");
}

async function checkProviders(): Promise<void> {
  const smsTo = requireEnvironment("SMOKE_SMS_TO");
  const emailTo = requireEnvironment("SMOKE_EMAIL_TO");
  const suffix = new Date().toISOString();
  const sms = await createSmsProvider().send(smsTo, `Legal Bhai production smoke test ${suffix}`);
  const email = await createEmailProvider().send(
    emailTo,
    "Legal Bhai production smoke test",
    `<p>Legal Bhai production smoke test ${suffix}</p>`,
  );
  if (!sms.providerId || !email.providerId) {
    throw new Error("Twilio or Resend did not return a provider delivery ID");
  }
  console.log("PASS Twilio SMS and Resend email provider requests");
}

async function checkErrorReporting(): Promise<void> {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production-smoke",
    sendDefaultPii: false,
  });
  const eventId = Sentry.captureMessage(`Legal Bhai production smoke ${new Date().toISOString()}`);
  if (!eventId || !await Sentry.flush(10_000)) {
    throw new Error("Sentry did not accept the production smoke event");
  }
  console.log("PASS Sentry production smoke event");
}

async function checkStaffOtp(apiBaseUrl: string): Promise<string> {
  const phone = requireEnvironment("SMOKE_STAFF_PHONE");
  const request = await requestJson(`${apiBaseUrl}/v1/auth/otp/request`, {
    method: "POST",
    body: JSON.stringify({ actorType: "staff", phone }),
  });
  if (!request.expiresAt || "devCode" in request) {
    throw new Error("Staff OTP response was not a production OTP response for an invited/existing lawyer");
  }
  const code = await readOtp("SMOKE_STAFF_OTP_CODE", "Enter the staff OTP received by SMS: ");
  const verified = await requestJson(`${apiBaseUrl}/v1/auth/otp/verify`, {
    method: "POST",
    body: JSON.stringify({ actorType: "staff", phone, code }),
  });
  const token = String(verified.token ?? "");
  if (!token) {
    throw new Error("Staff OTP verification did not return a token");
  }
  const headers = { authorization: `Bearer ${token}` };
  await requestJson(`${apiBaseUrl}/v1/me`, { headers });
  await requestJson(`${apiBaseUrl}/v1/matters`, { headers });
  const history = await requestJson(`${apiBaseUrl}/v1/notifications/history`, { headers });
  const notifications = Array.isArray(history.notifications) ? history.notifications as Array<{ status?: string }> : [];
  if (!notifications.some((job) => job.status === "sent")) {
    throw new Error("No successfully delivered notification job is recorded for the smoke-test lawyer");
  }
  console.log("PASS real staff OTP, authenticated workspace reads, and delivery history");
  return token;
}

async function checkPortalOtp(apiBaseUrl: string): Promise<void> {
  const portalToken = requireEnvironment("SMOKE_PORTAL_TOKEN");
  await requestJson(`${apiBaseUrl}/v1/portal/cases?token=${encodeURIComponent(portalToken)}`, {}, 401);
  const request = await requestJson(`${apiBaseUrl}/v1/portal/otp`, {
    method: "POST",
    body: JSON.stringify({ token: portalToken }),
  });
  if (!request.expiresAt || "devCode" in request) {
    throw new Error("Portal OTP response was not a production OTP response");
  }
  const code = await readOtp("SMOKE_PORTAL_OTP_CODE", "Enter the client portal OTP received by SMS: ");
  const verified = await requestJson(`${apiBaseUrl}/v1/portal/otp/verify`, {
    method: "POST",
    body: JSON.stringify({ token: portalToken, code }),
  });
  if (typeof verified.token !== "string" || verified.refreshToken !== null) {
    throw new Error("Portal OTP did not return a short-lived portal-scoped token");
  }
  await requestJson(`${apiBaseUrl}/v1/portal/cases?token=${encodeURIComponent(portalToken)}`, {}, 401);
  const portalHeaders = { authorization: `Bearer ${verified.token}` };
  const after = await requestJson(`${apiBaseUrl}/v1/portal/cases?token=${encodeURIComponent(portalToken)}`, { headers: portalHeaders });
  if (!Array.isArray(after.cases) || after.cases.length !== 1) {
    throw new Error("Portal token did not expose exactly one matter after OTP");
  }
  await requestJson(`${apiBaseUrl}/v1/clients/me/matters`, { headers: portalHeaders }, 403);
  console.log("PASS client OTP, short-lived portal scope, and exact-one-matter isolation");
}

process.env.NODE_ENV = "production";
validateProductionEnvironment();
const apiBaseUrl = requireHttps("PUBLIC_API_URL", apiUrl);
const webBaseUrl = requireHttps("PUBLIC_WEB_URL", webUrl);

await checkPublicSurfaces(apiBaseUrl, webBaseUrl);
await checkR2();
await checkProviders();
await checkErrorReporting();
await checkStaffOtp(apiBaseUrl);
await checkPortalOtp(apiBaseUrl);
console.log("Legal Bhai production smoke test passed");
