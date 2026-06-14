import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { STAGES } from "@wakeel/shared";
import { buildServer, publicErrorDetails } from "../src/app.js";
import { validateProductionEnvironment } from "../src/lib/config.js";
import { IHC_CAUSE_LIST_TYPE_CODES, normalizeIhcCaseNumber, parseIhcCauseList } from "../src/lib/ihc.js";
import { nextDayAgendaSchedule, renderNotificationTemplate } from "../src/lib/notification-schedule.js";
import { renderNotificationPreview } from "../src/lib/notifications.js";
import { createStore } from "../src/lib/store.js";
import { normalizePakistanPhone, toPakistanE164 } from "../src/lib/validation.js";

const fixtureDir = join(process.cwd(), "test", "fixtures");
const htmlFixtures = [
  join(fixtureDir, "ihc-2026-04-20-regular.html"),
  join(fixtureDir, "ihc-2026-04-21-regular.html"),
  join(fixtureDir, "ihc-2026-04-22-regular.html"),
];
const canonicalizationFixturePath = join(fixtureDir, "ihc-canonicalization-fixture.json");
const tempDir = mkdtempSync(join(tmpdir(), "wakeel-api-test-"));

process.env.DEMO_DB_PATH = join(tempDir, "demo.sqlite");
process.env.JWT_SECRET = "test-secret";
process.env.ENABLE_DEMO_SURFACES = "true";
delete process.env.CORS_ORIGINS;
delete process.env.NODE_ENV;

const store = createStore(process.env.DEMO_DB_PATH);
const app = buildServer(store);

let adminToken = "";
let associateToken = "";
let juniorToken = "";

async function verifyDemoUser(phone: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/demo/verify",
    payload: {
      phone,
      code: "111111",
    },
  });
  return response.json().token as string;
}

function buildMultipartPayload(fileSize = 16, overrides: Partial<Record<string, string>> = {}) {
  const boundary = "----wakeel-demo-boundary";
  const fields = {
    hearingDate: "2026-04-16",
    outcome: "order_passed",
    notes: "Uploaded from automated test",
    nextDateGiven: "2026-04-24",
    stageAfter: "notice",
    ...overrides,
  };

  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="hearingDate"\r\n\r\n${fields.hearingDate}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="outcome"\r\n\r\n${fields.outcome}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\n${fields.notes}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="nextDateGiven"\r\n\r\n${fields.nextDateGiven}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="stageAfter"\r\n\r\n${fields.stageAfter}\r\n`),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="order.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    Buffer.alloc(fileSize, "a"),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return { boundary, payload };
}

async function createIsolatedApp(environment: NodeJS.ProcessEnv = {}) {
  const isolatedTempDir = mkdtempSync(join(tmpdir(), "wakeel-api-isolated-"));
  const dbPath = join(isolatedTempDir, "demo.sqlite");
  const previousEnv = {
    DEMO_DB_PATH: process.env.DEMO_DB_PATH,
    ENABLE_DEMO_SURFACES: process.env.ENABLE_DEMO_SURFACES,
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
    PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
  };
  const requestedPreviousEnv = Object.fromEntries(Object.keys(environment).map((name) => [name, process.env[name]]));

  process.env.DEMO_DB_PATH = dbPath;
  process.env.JWT_SECRET = environment.JWT_SECRET ?? previousEnv.JWT_SECRET ?? "test-secret";
  if (environment.ENABLE_DEMO_SURFACES === undefined) {
    delete process.env.ENABLE_DEMO_SURFACES;
  } else {
    process.env.ENABLE_DEMO_SURFACES = environment.ENABLE_DEMO_SURFACES;
  }
  if (environment.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = environment.NODE_ENV;
  }
  if (environment.CORS_ORIGINS === undefined) {
    delete process.env.CORS_ORIGINS;
  } else {
    process.env.CORS_ORIGINS = environment.CORS_ORIGINS;
  }
  for (const name of ["DATABASE_URL", "PUBLIC_API_URL", "PUBLIC_WEB_URL"] as const) {
    if (environment[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = environment[name];
    }
  }
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) {
      process.env[name] = value;
    }
  }

  const isolatedStore = createStore(dbPath);
  const isolatedApp = buildServer(isolatedStore);
  await isolatedApp.ready();

  return {
    app: isolatedApp,
    store: isolatedStore,
    cleanup: async () => {
      await isolatedApp.close();
      isolatedStore.close();
      rmSync(isolatedTempDir, { recursive: true, force: true });
      process.env.DEMO_DB_PATH = previousEnv.DEMO_DB_PATH;
      process.env.ENABLE_DEMO_SURFACES = previousEnv.ENABLE_DEMO_SURFACES;
      process.env.NODE_ENV = previousEnv.NODE_ENV;
      process.env.JWT_SECRET = previousEnv.JWT_SECRET;
      process.env.DATABASE_URL = previousEnv.DATABASE_URL;
      process.env.PUBLIC_API_URL = previousEnv.PUBLIC_API_URL;
      process.env.PUBLIC_WEB_URL = previousEnv.PUBLIC_WEB_URL;
      if (previousEnv.CORS_ORIGINS === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = previousEnv.CORS_ORIGINS;
      }
      for (const [name, value] of Object.entries(requestedPreviousEnv)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    },
  };
}

before(async () => {
  await app.ready();
  adminToken = await verifyDemoUser("03001234567");
  associateToken = await verifyDemoUser("03007654321");
  juniorToken = await verifyDemoUser("03001112222");
});

after(async () => {
  await app.close();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

test("IHC parser smoke-tests all real fixtures without leaking header rows", () => {
  for (const fixturePath of htmlFixtures) {
    const html = readFileSync(fixturePath, "utf8");
    const rows = parseIhcCauseList(html);

    assert.ok(rows.length > 0, `${basename(fixturePath)} should parse rows`);
    assert.ok(rows.every((row) => row.caseNumber.length > 0), `${basename(fixturePath)} should keep case numbers`);
    assert.ok(
      rows.every((row) => !/respected judge|case no/i.test(`${row.judgeNames} ${row.caseNumber}`)),
      `${basename(fixturePath)} should not parse header cells as cases`,
    );
  }
});

test("IHC canonicalization fixture covers 50 real snapshot case cells", () => {
  const fixtures = JSON.parse(readFileSync(canonicalizationFixturePath, "utf8")) as Array<{
    rawCaseCellHtml: string;
    expected: string;
  }>;

  assert.equal(fixtures.length, 50);
  let passed = 0;
  for (const fixture of fixtures) {
    assert.equal(normalizeIhcCaseNumber(fixture.rawCaseCellHtml), fixture.expected);
    passed += 1;
  }

  console.log(`IHC canonicalization fixture: ${passed}/${fixtures.length} passed`);
});

test("matcher evaluation accepts known matches and rejects an unmatched case", () => {
  const fixtures = htmlFixtures.flatMap((fixturePath) => parseIhcCauseList(readFileSync(fixturePath, "utf8")));
  const parsedSet = new Set(fixtures.map((row) => row.caseNumber));
  const harness = [
    { caseNumber: "WRIT PETITION 2076/2019", expectedMatch: true },
    { caseNumber: "SALES TAX REFERENCE 9/2016", expectedMatch: true },
    { caseNumber: "CUSTOM REFERENCE 6/2024", expectedMatch: true },
    { caseNumber: "CRIMINAL APPEAL 230/2025", expectedMatch: true },
    { caseNumber: "INTRA COURT APPEAL 457/2022", expectedMatch: true },
    { caseNumber: "WRIT PETITION 999999/2099", expectedMatch: false },
  ];
  let passed = 0;
  for (const example of harness) {
    const matched = parsedSet.has(example.caseNumber);
    assert.equal(matched, example.expectedMatch, `${example.caseNumber} match state`);
    passed += 1;
  }

  console.log(`IHC matcher evaluation summary: ${passed}/${harness.length} passed`);
});

test("notification preview fills client-facing placeholders", () => {
  const caseRecord = store.listCases()[0];
  const rendered = renderNotificationPreview("reminder", { caseRecord });
  assert.match(rendered, /Dear/);
  assert.match(rendered, /Wakeel demo/);
});

test("Pakistani mobile numbers normalize consistently", () => {
  assert.equal(normalizePakistanPhone("0300-1234567"), "03001234567");
  assert.equal(normalizePakistanPhone("+92 300 1234567"), "03001234567");
  assert.equal(toPakistanE164("3001234567"), "+923001234567");
  assert.equal(normalizePakistanPhone("051-1234567"), null);
});

test("IHC production provider uses verified regular, supplementary, and urgent list types", () => {
  assert.deepEqual(IHC_CAUSE_LIST_TYPE_CODES, { regular: 4, supplementary: 2, urgent: 3 });
});

test("lawyer next-day agenda is scheduled for 7 PM Pakistan time", () => {
  assert.deepEqual(nextDayAgendaSchedule(new Date("2026-06-12T10:00:00.000Z")), {
    agendaDate: "2026-06-13",
    scheduledAt: "2026-06-12T14:00:00.000Z",
  });
});

test("versioned notification templates render stored payload placeholders", () => {
  assert.deepEqual(renderNotificationTemplate({
    templateKey: "client_hearing_reminder",
    channel: "sms",
    version: 1,
    subjectTemplate: "",
    bodyTemplate: "Hearing details:\n{{payload}}",
    enabled: true,
  }, {
    rawCaseNumber: "W.P. 123/2026",
  }), {
    subject: "",
    body: "Hearing details:\n{\n  \"rawCaseNumber\": \"W.P. 123/2026\"\n}",
  });
});

test("stage enum remains locked across the demo contract", () => {
  assert.deepEqual(STAGES, [
    "filing",
    "notice",
    "written_statement",
    "issues",
    "evidence",
    "arguments",
    "reserved",
    "decided",
  ]);
});

test("demo auth returns JWT-like token for seeded user when demo surfaces are on", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/demo/verify",
    payload: {
      phone: "03001234567",
      code: "111111",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.json().token);
});

test("malformed signed tokens fail closed instead of causing internal errors", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const malformedPayload = Buffer.from("{").toString("base64url");
  const body = `${header}.${malformedPayload}`;
  const signature = createHmac("sha256", process.env.JWT_SECRET!).update(body).digest("base64url");
  const authorization = `Bearer ${body}.${signature}`;

  assert.equal((await app.inject({ method: "GET", url: "/me", headers: { authorization } })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/v1/me", headers: { authorization } })).statusCode, 401);
});

test("demo auth routes return 404 when demo surfaces are off", async () => {
  const isolated = await createIsolatedApp({ ENABLE_DEMO_SURFACES: "false" });
  try {
    const requestCode = await isolated.app.inject({
      method: "POST",
      url: "/auth/demo/request-code",
      payload: { phone: "03001234567" },
    });
    const verify = await isolated.app.inject({
      method: "POST",
      url: "/auth/demo/verify",
      payload: { phone: "03001234567", code: "111111" },
    });

    assert.equal(requestCode.statusCode, 404);
    assert.equal(verify.statusCode, 404);
  } finally {
    await isolated.cleanup();
  }
});

test("trusted loopback proxy rate limits forwarded clients independently", async () => {
  const isolated = await createIsolatedApp({ TRUST_PROXY_LOOPBACK: "true" });
  try {
    const requestFrom = (ip: string) => isolated.app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      headers: { "x-forwarded-for": ip },
      payload: {},
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      assert.equal((await requestFrom("203.0.113.10")).statusCode, 400);
    }
    assert.equal((await requestFrom("203.0.113.10")).statusCode, 429);
    assert.equal((await requestFrom("203.0.113.11")).statusCode, 400);
  } finally {
    await isolated.cleanup();
  }
});

test("case create and assign work through API", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/cases",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      rawCaseNumber: "Civil Appeal 99/2026",
      normalizedCaseNumber: "CIVIL APPEAL 99/2026",
      court: "Islamabad District Court East",
      title: "Demo Appellant v Demo Respondent",
      stage: "filing",
      nextDate: "2026-04-20",
      assignedToUserId: "user-associate",
      clientName: "Demo Client",
      clientPhone: "03009998888",
      sourceType: "demo_district",
      judgeName: "Civil Judge East-II",
      benchName: "Room 14",
    },
  });
  assert.equal(createResponse.statusCode, 201);
  const createdCase = createResponse.json().case;

  const assignResponse = await app.inject({
    method: "POST",
    url: `/cases/${createdCase.id}/assign`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      userId: "user-junior",
    },
  });

  assert.equal(assignResponse.statusCode, 200);
  assert.equal(assignResponse.json().case.assignedToUserId, "user-junior");
});

test("case ownership is enforced across guarded case routes", async () => {
  const associateCase = store.listCases().find((caseRecord) => caseRecord.assignedToUserId === "user-associate");
  assert.ok(associateCase);

  const ownCaseResponse = await app.inject({
    method: "GET",
    url: `/cases/${associateCase.id}`,
    headers: {
      authorization: `Bearer ${associateToken}`,
    },
  });
  assert.equal(ownCaseResponse.statusCode, 200);

  const forbiddenGet = await app.inject({
    method: "GET",
    url: `/cases/${associateCase.id}`,
    headers: {
      authorization: `Bearer ${juniorToken}`,
    },
  });
  assert.equal(forbiddenGet.statusCode, 403);

  const forbiddenPatch = await app.inject({
    method: "PATCH",
    url: `/cases/${associateCase.id}`,
    headers: {
      authorization: `Bearer ${juniorToken}`,
      "content-type": "application/json",
    },
    payload: { title: "Should fail" },
  });
  assert.equal(forbiddenPatch.statusCode, 403);

  const forbiddenAssign = await app.inject({
    method: "POST",
    url: `/cases/${associateCase.id}/assign`,
    headers: {
      authorization: `Bearer ${juniorToken}`,
    },
    payload: { userId: "user-admin" },
  });
  assert.equal(forbiddenAssign.statusCode, 403);

  const { boundary, payload } = buildMultipartPayload();
  const forbiddenHearing = await app.inject({
    method: "POST",
    url: `/cases/${associateCase.id}/hearings`,
    headers: {
      authorization: `Bearer ${juniorToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  assert.equal(forbiddenHearing.statusCode, 403);

  const forbiddenShare = await app.inject({
    method: "POST",
    url: `/cases/${associateCase.id}/share-link`,
    headers: {
      authorization: `Bearer ${juniorToken}`,
    },
  });
  assert.equal(forbiddenShare.statusCode, 403);

  const forbiddenPreview = await app.inject({
    method: "POST",
    url: "/notifications/preview",
    headers: {
      authorization: `Bearer ${juniorToken}`,
    },
    payload: { caseId: associateCase.id, type: "reminder" },
  });
  assert.equal(forbiddenPreview.statusCode, 403);
});

test("calendar includes both source labels and reports lastSyncedAt only after a real sync write", async () => {
  const initialResponse = await app.inject({
    method: "GET",
    url: "/calendar/today",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(initialResponse.statusCode, 200);
  const initialPayload = initialResponse.json();
  assert.equal(initialPayload.lastSyncedAt, null);
  const sources = initialPayload.entries.map((entry: { source: string }) => entry.source);
  assert.ok(sources.includes("live_ihc"));
  assert.ok(sources.includes("demo_district"));

  const liveCase = store.listIhcCases()[0];
  store.addCalendarEntries(
    [
      {
        caseId: liveCase.id,
        court: "Islamabad High Court",
        bench: "Court No: 8",
        date: initialPayload.date,
        timeSlot: "12:30 PM",
        source: "live_ihc",
        sourceConfidence: 0.98,
        judgeNames: "Justice Muhammad Azam Khan / Justice Inaam Ameen Minhas",
      },
    ],
    false,
  );

  const refreshedResponse = await app.inject({
    method: "GET",
    url: "/calendar/today",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(refreshedResponse.statusCode, 200);
  assert.ok(refreshedResponse.json().lastSyncedAt);
});

test("hearing upload creates a hearing log and stores OCR status", async () => {
  const caseRecord = store.listIhcCases()[0];
  const { boundary, payload } = buildMultipartPayload();

  const response = await app.inject({
    method: "POST",
    url: `/cases/${caseRecord.id}/hearings`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().hearing.ocrStatus, "pending_config");
  assert.match(response.json().hearing.notes, /automated test/);
});

test("oversized hearing uploads are rejected with 413", async () => {
  const caseRecord = store.listIhcCases()[0];
  const { boundary, payload } = buildMultipartPayload(10 * 1024 * 1024 + 16);

  const response = await app.inject({
    method: "POST",
    url: `/cases/${caseRecord.id}/hearings`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });

  assert.equal(response.statusCode, 413);
});

test("upload access is protected by auth and case ownership", async () => {
  const liveCase = store.listIhcCases()[0];
  const { boundary, payload } = buildMultipartPayload(64, { notes: "Upload owner protection test" });

  const uploadResponse = await app.inject({
    method: "POST",
    url: `/cases/${liveCase.id}/hearings`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  assert.equal(uploadResponse.statusCode, 200);
  const imageUrl = uploadResponse.json().hearing.imageUrl as string;
  const filename = imageUrl.split("/uploads/")[1];

  const adminFetch = await app.inject({
    method: "GET",
    url: `/uploads/${filename}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(adminFetch.statusCode, 200);

  const unauthorizedFetch = await app.inject({
    method: "GET",
    url: `/uploads/${filename}`,
    headers: {
      authorization: `Bearer ${associateToken}`,
    },
  });
  assert.equal(unauthorizedFetch.statusCode, 404);

  const missingFetch = await app.inject({
    method: "GET",
    url: "/uploads/not-a-real-file.jpg",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(missingFetch.statusCode, 404);
});

test("share links expose read-only case payload", async () => {
  const caseRecord = store.listIhcCases()[0];
  const createLink = await app.inject({
    method: "POST",
    url: `/cases/${caseRecord.id}/share-link`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });

  assert.equal(createLink.statusCode, 200);
  const shareUrl = createLink.json().shareUrl as string;
  const token = shareUrl.split("/share/")[1];

  const shared = await app.inject({
    method: "GET",
    url: `/share/${token}`,
  });

  assert.equal(shared.statusCode, 200);
  assert.equal(shared.json().caseRecord.id, caseRecord.id);
});

test("expired or invalid share tokens are rejected", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/share/not-a-real-token",
  });

  assert.equal(response.statusCode, 404);
});

test("reset demo is admin-only, demo-surface-gated, and clears uploaded files", async () => {
  const liveCase = store.listIhcCases()[0];
  const { boundary, payload } = buildMultipartPayload(64, { notes: "Reset demo upload" });
  const uploadResponse = await app.inject({
    method: "POST",
    url: `/cases/${liveCase.id}/hearings`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  const uploadedImageUrl = uploadResponse.json().hearing.imageUrl as string;
  const uploadedFilename = uploadedImageUrl.split("/uploads/")[1];

  const nonAdminReset = await app.inject({
    method: "POST",
    url: "/admin/reset-demo",
    headers: {
      authorization: `Bearer ${associateToken}`,
    },
  });
  assert.equal(nonAdminReset.statusCode, 403);

  const adminReset = await app.inject({
    method: "POST",
    url: "/admin/reset-demo",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(adminReset.statusCode, 200);
  assert.ok(adminReset.json().resetAt);

  const casesAfterReset = await app.inject({
    method: "GET",
    url: "/cases",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(casesAfterReset.statusCode, 200);
  assert.equal(casesAfterReset.json().cases.length, 3);

  const fetchAfterReset = await app.inject({
    method: "GET",
    url: `/uploads/${uploadedFilename}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(fetchAfterReset.statusCode, 404);

  const isolated = await createIsolatedApp({ ENABLE_DEMO_SURFACES: "false" });
  try {
    const isolatedAdminToken = await (async () => {
      const response = await isolated.app.inject({
        method: "POST",
        url: "/auth/demo/verify",
        payload: {
          phone: "03001234567",
          code: "111111",
        },
      });
      return response.json().token as string | undefined;
    })();
    assert.equal(isolatedAdminToken, undefined);

    const resetWhenDisabled = await isolated.app.inject({
      method: "POST",
      url: "/admin/reset-demo",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(resetWhenDisabled.statusCode, 404);
  } finally {
    await isolated.cleanup();
  }
});

test("CORS allowlist is enforced and production startup fails when unset", async () => {
  const isolated = await createIsolatedApp({
    ENABLE_DEMO_SURFACES: "false",
    NODE_ENV: "production",
    CORS_ORIGINS: "https://legalbahi.pk,https://allowed.legalbahi.pk",
    DATABASE_URL: "postgresql://test:test@localhost:5432/legalbahi",
    PUBLIC_API_URL: "https://api.legalbahi.pk",
    PUBLIC_WEB_URL: "https://legalbahi.pk",
    JWT_SECRET: "n5C8XqL2vR7pK4mT9sW6yB3dF8hJ1zQa",
    PILOT_ADMIN_SECRET: "q2W7eR4tY9uI6oP3aS8dF5gH1jK0lZxC",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    TWILIO_SMS_FROM: "+15555550100",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "pilot@legalbahi.pk",
    R2_ACCOUNT_ID: "r2-test",
    R2_ACCESS_KEY_ID: "r2-access",
    R2_SECRET_ACCESS_KEY: "r2-secret",
    R2_DOCUMENT_BUCKET: "documents",
    R2_BACKUP_BUCKET: "backups",
    BACKUP_AGE_RECIPIENT: `age1${"q".repeat(58)}`,
    SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    IHC_SYNC_ENABLED: "true",
    TRUST_PROXY_LOOPBACK: "true",
  });
  try {
    const allowedOrigin = await isolated.app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://allowed.legalbahi.pk" },
    });
    assert.equal(allowedOrigin.headers["access-control-allow-origin"], "https://allowed.legalbahi.pk");

    const disallowedOrigin = await isolated.app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://blocked.test" },
    });
    assert.equal(disallowedOrigin.headers["access-control-allow-origin"], undefined);

    const deferredProductRoute = await isolated.app.inject({ method: "GET", url: "/v1/time-entries" });
    assert.equal(deferredProductRoute.statusCode, 404);
    const deferredReportRoute = await isolated.app.inject({ method: "GET", url: "/v1/reports/overview" });
    assert.equal(deferredReportRoute.statusCode, 404);
    const deferredMagicLink = await isolated.app.inject({
      method: "POST",
      url: "/auth/staff/magic-link/request",
      payload: { email: "pilot@legalbahi.test" },
    });
    assert.equal(deferredMagicLink.statusCode, 404);
  } finally {
    await isolated.cleanup();
  }

  const isolatedTempDir = mkdtempSync(join(tmpdir(), "wakeel-api-production-"));
  const dbPath = join(isolatedTempDir, "demo.sqlite");
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCorsOrigins = process.env.CORS_ORIGINS;
  const previousDbPath = process.env.DEMO_DB_PATH;

  process.env.NODE_ENV = "production";
  delete process.env.CORS_ORIGINS;
  process.env.DEMO_DB_PATH = dbPath;

  const isolatedStore = createStore(dbPath);
  assert.throws(() => buildServer(isolatedStore), /CORS_ORIGINS/);
  isolatedStore.close();

  process.env.NODE_ENV = previousNodeEnv;
  process.env.DEMO_DB_PATH = previousDbPath;
  if (previousCorsOrigins === undefined) {
    delete process.env.CORS_ORIGINS;
  } else {
    process.env.CORS_ORIGINS = previousCorsOrigins;
  }
  rmSync(isolatedTempDir, { recursive: true, force: true });
});

test("production requires separate document and backup R2 buckets", () => {
  const productionEnvironment = {
    NODE_ENV: "production",
    JWT_SECRET: "n5C8XqL2vR7pK4mT9sW6yB3dF8hJ1zQa",
    CORS_ORIGINS: "https://legalbahi.pk",
    DATABASE_URL: "postgresql://test:test@localhost:5432/legalbahi",
    PUBLIC_API_URL: "https://api.legalbahi.pk",
    PUBLIC_WEB_URL: "https://legalbahi.pk",
    PILOT_ADMIN_SECRET: "q2W7eR4tY9uI6oP3aS8dF5gH1jK0lZxC",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    TWILIO_SMS_FROM: "+15555550100",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "pilot@legalbahi.pk",
    R2_ACCOUNT_ID: "r2-test",
    R2_ACCESS_KEY_ID: "r2-access",
    R2_SECRET_ACCESS_KEY: "r2-secret",
    R2_DOCUMENT_BUCKET: "shared-bucket",
    R2_BACKUP_BUCKET: "shared-bucket",
    BACKUP_AGE_RECIPIENT: `age1${"q".repeat(58)}`,
    SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    IHC_SYNC_ENABLED: "true",
    TRUST_PROXY_LOOPBACK: "true",
    ENABLE_DEMO_SURFACES: "false",
    ENABLE_PRODUCT_SEED_DATA: "false",
  };
  const previous = Object.fromEntries(Object.keys(productionEnvironment).map((name) => [name, process.env[name]]));
  Object.assign(process.env, productionEnvironment);
  try {
    assert.throws(() => validateProductionEnvironment(), /separate R2 buckets/);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("production rejects placeholder public hosts even when required values exist", () => {
  const productionEnvironment = {
    NODE_ENV: "production",
    JWT_SECRET: "n5C8XqL2vR7pK4mT9sW6yB3dF8hJ1zQa",
    CORS_ORIGINS: "https://legalbahi.example.com",
    DATABASE_URL: "postgresql://test:test@localhost:5432/legalbahi",
    PUBLIC_API_URL: "https://api.legalbahi.example.com",
    PUBLIC_WEB_URL: "https://legalbahi.example.com",
    PILOT_ADMIN_SECRET: "q2W7eR4tY9uI6oP3aS8dF5gH1jK0lZxC",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    TWILIO_SMS_FROM: "+15555550100",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "pilot@legalbahi.pk",
    R2_ACCOUNT_ID: "r2-test",
    R2_ACCESS_KEY_ID: "r2-access",
    R2_SECRET_ACCESS_KEY: "r2-secret",
    R2_DOCUMENT_BUCKET: "documents",
    R2_BACKUP_BUCKET: "backups",
    BACKUP_AGE_RECIPIENT: `age1${"q".repeat(58)}`,
    SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    IHC_SYNC_ENABLED: "true",
    TRUST_PROXY_LOOPBACK: "true",
    ENABLE_DEMO_SURFACES: "false",
    ENABLE_PRODUCT_SEED_DATA: "false",
  };
  const previous = Object.fromEntries(Object.keys(productionEnvironment).map((name) => [name, process.env[name]]));
  Object.assign(process.env, productionEnvironment);
  try {
    assert.throws(() => validateProductionEnvironment(), /permanent production hostname/);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("production error responses hide internal 5xx details but preserve 4xx messages", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.deepEqual(publicErrorDetails(new Error("database password leaked"), 200), {
      statusCode: 500,
      message: "Unexpected server error",
    });
    assert.deepEqual(publicErrorDetails(Object.assign(new Error("Invalid JSON"), { statusCode: 400 }), 200), {
      statusCode: 400,
      message: "Invalid JSON",
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});
