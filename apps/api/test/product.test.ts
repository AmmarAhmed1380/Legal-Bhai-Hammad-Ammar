import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";

import { buildServer } from "../src/app.js";
import { createStore } from "../src/lib/store.js";

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupTasks.length > 0) {
    const cleanup = cleanupTasks.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

async function createProductApp() {
  const tempDir = mkdtempSync(join(tmpdir(), "wakeel-product-api-"));
  const demoDbPath = join(tempDir, "demo.sqlite");
  const productDbPath = join(tempDir, "product.sqlite");
  const previousEnv = {
    DEMO_DB_PATH: process.env.DEMO_DB_PATH,
    WAKEEL_PRODUCT_DB_PATH: process.env.WAKEEL_PRODUCT_DB_PATH,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    PILOT_ADMIN_SECRET: process.env.PILOT_ADMIN_SECRET,
  };

  process.env.DEMO_DB_PATH = demoDbPath;
  process.env.WAKEEL_PRODUCT_DB_PATH = productDbPath;
  process.env.JWT_SECRET = "product-test-secret";
  delete process.env.NODE_ENV;
  delete process.env.CORS_ORIGINS;
  process.env.PILOT_ADMIN_SECRET = "pilot-test-secret";

  const demoStore = createStore(demoDbPath);
  const app = buildServer(demoStore);
  await app.ready();

  const cleanup = async () => {
    await app.close();
    demoStore.close();
    rmSync(tempDir, { recursive: true, force: true });
    if (previousEnv.DEMO_DB_PATH === undefined) {
      delete process.env.DEMO_DB_PATH;
    } else {
      process.env.DEMO_DB_PATH = previousEnv.DEMO_DB_PATH;
    }
    if (previousEnv.WAKEEL_PRODUCT_DB_PATH === undefined) {
      delete process.env.WAKEEL_PRODUCT_DB_PATH;
    } else {
      process.env.WAKEEL_PRODUCT_DB_PATH = previousEnv.WAKEEL_PRODUCT_DB_PATH;
    }
    if (previousEnv.JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    }
    if (previousEnv.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousEnv.NODE_ENV;
    }
    if (previousEnv.CORS_ORIGINS === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousEnv.CORS_ORIGINS;
    }
    if (previousEnv.PILOT_ADMIN_SECRET === undefined) {
      delete process.env.PILOT_ADMIN_SECRET;
    } else {
      process.env.PILOT_ADMIN_SECRET = previousEnv.PILOT_ADMIN_SECRET;
    }
  };

  cleanupTasks.push(cleanup);

  return { app, productDbPath };
}

function seedSecondWorkspace(productDbPath: string) {
  const db = new DatabaseSync(productDbPath);
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO firms (id, name, primary_city, billing_plan, timezone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("firm-other", "Other Chambers", "Rawalpindi", "solo", "Asia/Karachi", "trial", createdAt);
  db.prepare(
    "INSERT INTO product_users (id, phone, email, display_name, language, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("staff-other", "03009999999", "owner@other.test", "Other Owner", "en", "active", createdAt);
  db.prepare(
    "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions_json, office_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("membership-other", "firm-other", "staff-other", "owner", JSON.stringify(["*"]), "Rawalpindi", createdAt);
  db.prepare(`
    INSERT INTO matters (
      id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "matter-other",
    "firm-other",
    "ihc",
    "W.P. 999/2026",
    "WRIT PETITION 999/2026",
    "Other Chambers Matter",
    "litigation",
    "notice",
    "open",
    "2026-06-20",
    "staff-other",
    createdAt,
    createdAt,
  );
  db.prepare(
    "INSERT INTO message_threads (id, matter_id, participant_type, status, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run("thread-other", "matter-other", "firm_client", "open", createdAt);
  db.prepare(
    "INSERT INTO messages (id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("message-other", "thread-other", "staff", "staff-other", "Private other-workspace message", "en", "in_app", "delivered", createdAt);
  db.prepare(
    "INSERT INTO client_accounts (id, phone, display_name, language, status, created_at, firm_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("client-other", "03008888888", "Other Client", "en", "active", createdAt, "firm-other");
  db.prepare(
    "INSERT INTO client_memberships (id, client_account_id, matter_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run("client-membership-other", "client-other", "matter-other", "message", createdAt);
  db.prepare(`
    INSERT INTO documents (
      id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "doc-other",
    "firm-other",
    "matter-other",
    null,
    "pleading",
    "other.pdf",
    "virtual:other",
    "application/pdf",
    "staff-other",
    "pending",
    null,
    null,
    0,
    createdAt,
  );
  db.prepare(
    "INSERT INTO matter_parties (id, matter_id, party_type, display_name, contact_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("party-other", "matter-other", "petitioner", "Other Petitioner", null, createdAt);
  db.prepare(
    "INSERT INTO hearings (id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("hearing-other", "matter-other", createdAt, "Other outcome", "Private other-workspace notes", null, null, null, "manual_staff", null, createdAt);
  db.prepare(
    "INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("calendar-other", "matter-other", "2026-06-20", "Court 9", "Other Bench", "manual_staff", 1, "none", createdAt);
  db.prepare(
    "INSERT INTO alerts (id, firm_id, type, title, body, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("alert-other", "firm-other", "matter_update", "Other alert", "Private other-workspace alert", createdAt, null);
  db.prepare(
    "INSERT INTO cause_list_entries (id, court_source_id, list_date, list_type, normalized_case_number, raw_case_number, courtroom, bench, source_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("cause-other", "source-ihc", "2026-06-20", "regular", "WRIT PETITION 999/2026", "W.P. 999/2026", "Court 9", "Other Bench", "source-hash-other", createdAt);
  db.prepare(
    "INSERT INTO matter_matches (id, firm_id, matter_id, cause_list_entry_id, confidence, state, reviewed_by, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("match-other", "firm-other", "matter-other", "cause-other", 1, "auto_matched", null, null, createdAt);
  db.prepare(
    "INSERT INTO notification_jobs (id, firm_id, actor_type, actor_id, channel, template_key, payload_json, idempotency_key, scheduled_at, status, attempt_count, last_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("notification-other", "firm-other", "staff", "staff-other", "sms", "lawyer_next_day_agenda", "{}", "notification-other", createdAt, "sent", 1, null, createdAt);
  db.prepare(
    "INSERT INTO invoices (id, firm_id, client_account_id, matter_id, status, issued_at, due_at, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("invoice-other", "firm-other", "client-other", "matter-other", "draft", null, null, 1000, createdAt);
  db.close();
}

async function login(app: ReturnType<typeof buildServer>, actorType: "staff" | "client", phone: string) {
  const otpRequest = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType, phone },
  });
  assert.equal(otpRequest.statusCode, 200);

  const { devCode } = otpRequest.json() as { devCode: string };
  const otpVerify = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/verify",
    payload: { actorType, phone, code: devCode },
  });
  assert.equal(otpVerify.statusCode, 200);
  return otpVerify.json() as { token: string; refreshToken: string; expiresInSeconds: number };
}

async function verifyPortal(app: ReturnType<typeof buildServer>, portalToken: string): Promise<string> {
  const request = await app.inject({ method: "POST", url: "/v1/portal/otp", payload: { token: portalToken } });
  assert.equal(request.statusCode, 200);
  const code = (request.json() as { devCode: string }).devCode;
  const verify = await app.inject({
    method: "POST",
    url: "/v1/portal/otp/verify",
    payload: { token: portalToken, code },
  });
  assert.equal(verify.statusCode, 200);
  return (verify.json() as { token: string }).token;
}

test("product staff OTP auth loads firm profile and seeded matters", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");

  const meResponse = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(meResponse.statusCode, 200);
  const me = meResponse.json() as {
    profile: { actorType: "staff"; firm: { name: string } | null; staffUser: { displayName: string } };
  };
  assert.equal(me.profile.actorType, "staff");
  assert.equal(me.profile.firm?.name, "Hassan & Co. Law Associates");
  assert.equal(me.profile.staffUser.displayName, "Advocate Salman Hassan");

  const mattersResponse = await app.inject({
    method: "GET",
    url: "/v1/matters",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(mattersResponse.statusCode, 200);
  const matters = (mattersResponse.json() as { matters: Array<{ id: string }> }).matters;
  assert.equal(matters.length, 2);
  assert.ok(matters.some((matter) => matter.id === "matter-redtone"));
  assert.ok(matters.some((matter) => matter.id === "matter-farooq"));
});

test("OTP requests do not send codes for unknown clients and reject invalid actor types", async () => {
  const { app } = await createProductApp();

  const unknownClient = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "client", phone: "03009999999" },
  });
  assert.equal(unknownClient.statusCode, 200);
  assert.deepEqual(unknownClient.json(), { ok: true, expiresAt: null });

  const invalidActor = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "admin", phone: "03001234567" },
  });
  assert.equal(invalidActor.statusCode, 400);
});

test("pilot mutation routes reject malformed runtime payloads", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };

  const responses = await Promise.all([
    app.inject({ method: "POST", url: "/v1/auth/otp/request" }),
    app.inject({
      method: "POST",
      url: "/v1/pilot/invites",
      headers: { "x-pilot-admin-secret": "pilot-test-secret" },
    }),
    app.inject({ method: "POST", url: "/v1/matters", headers }),
    app.inject({ method: "POST", url: "/v1/clients", headers }),
    app.inject({ method: "POST", url: "/v1/portal/links", headers }),
    app.inject({ method: "PATCH", url: "/v1/notifications/preferences", headers }),
    app.inject({ method: "POST", url: "/v1/portal/otp/verify" }),
    app.inject({
      method: "POST",
      url: "/v1/matters",
      headers,
      payload: {
        courtId: "ihc",
        rawCaseNumber: "W.P. 900/2026",
        title: "Invalid status",
        matterType: "litigation",
        stage: "notice",
        status: "stolen",
      },
    }),
    app.inject({ method: "PATCH", url: "/v1/matters/matter-redtone", headers, payload: { status: "stolen" } }),
    app.inject({
      method: "POST",
      url: "/v1/matters/matter-redtone/parties",
      headers,
      payload: { partyType: "judge", displayName: "Invalid party" },
    }),
    app.inject({ method: "PATCH", url: "/v1/clients/client-redtone", headers, payload: { language: "fr" } }),
    app.inject({
      method: "PATCH",
      url: "/v1/notifications/preferences",
      headers,
      payload: { emailEnabled: "yes", smsEnabled: true },
    }),
    app.inject({
      method: "POST",
      url: "/v1/pilot/invites",
      headers: { "x-pilot-admin-secret": "pilot-test-secret" },
      payload: { phone: "03007770000", email: "not-an-email" },
    }),
    app.inject({
      method: "POST",
      url: "/v1/court-sources/source-ihc/sync",
      headers,
      payload: { listType: "unknown" },
    }),
    app.inject({
      method: "POST",
      url: "/v1/court-sources/source-ihc/sync",
      headers,
      payload: { listDate: "2026-02-31" },
    }),
    app.inject({
      method: "POST",
      url: "/v1/matters",
      headers,
      payload: {
        courtId: "ihc",
        rawCaseNumber: "W.P. 901/2026",
        title: "Impossible date",
        matterType: "litigation",
        stage: "notice",
        status: "open",
        nextHearingAt: "2026-02-31",
      },
    }),
    app.inject({
      method: "POST",
      url: "/v1/matters/matter-redtone/hearings",
      headers,
      payload: { outcome: "Adjourned", notes: "Impossible date", nextDate: "2026-02-31" },
    }),
  ]);

  for (const response of responses) {
    assert.equal(response.statusCode, 400, response.body);
  }

  const hearing = await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers,
    payload: { outcome: "Adjourned", notes: "No next date supplied.", nextDate: "" },
  });
  assert.equal(hearing.statusCode, 200);
  assert.equal((hearing.json() as { hearing: { nextDate: string | null } }).hearing.nextDate, null);
});

test("product client access is limited to shared matters", async () => {
  const { app } = await createProductApp();
  const staffToken = (await login(app, "staff", "03001234567")).token;
  const internalDocumentResponse = await app.inject({
    method: "POST",
    url: "/v1/documents",
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      matterId: "matter-redtone",
      type: "note",
      title: "internal-client-hidden.txt",
      mimeType: "text/plain",
      portalVisible: false,
    },
  });
  assert.equal(internalDocumentResponse.statusCode, 200);
  const internalDocumentId = (internalDocumentResponse.json() as { document: { id: string } }).document.id;
  const { token } = await login(app, "client", "03005550001");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/clients/me/matters",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(listResponse.statusCode, 200);
  const matters = (listResponse.json() as { matters: Array<{ id: string }> }).matters;
  assert.deepEqual(matters.map((matter) => matter.id), ["matter-redtone", "matter-farooq"]);

  const secondSharedMatter = await app.inject({
    method: "GET",
    url: "/v1/matters/matter-farooq",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(secondSharedMatter.statusCode, 200);
  const clientDocuments = await app.inject({
    method: "GET",
    url: "/v1/documents?matterId=matter-redtone",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.ok(!(clientDocuments.json() as { documents: Array<{ id: string }> }).documents.some((document) => document.id === internalDocumentId));
  for (const path of [`/v1/documents/${internalDocumentId}`, `/v1/documents/${internalDocumentId}/download`]) {
    assert.equal((await app.inject({
      method: "GET",
      url: path,
      headers: { authorization: `Bearer ${token}` },
    })).statusCode, 404);
  }
});

test("product staff can sync a court source, add a time entry, and fetch seeded document content", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03007654321");

  const courtSourcesResponse = await app.inject({
    method: "GET",
    url: "/v1/court-sources",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(courtSourcesResponse.statusCode, 200);
  const courtSources = (courtSourcesResponse.json() as { courtSources: Array<{ id: string; lastSuccessfulSyncAt: string | null }> }).courtSources;
  assert.ok(courtSources.length >= 3);

  const syncResponse = await app.inject({
    method: "POST",
    url: `/v1/court-sources/${courtSources[0].id}/sync`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(syncResponse.statusCode, 200);
  assert.ok((syncResponse.json() as { courtSource: { lastSuccessfulSyncAt: string | null } }).courtSource.lastSuccessfulSyncAt);

  const timeEntryResponse = await app.inject({
    method: "POST",
    url: "/v1/time-entries",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      matterId: "matter-redtone",
      startedAt: "2026-04-21T10:00:00+05:00",
      minutes: 45,
      narrative: "Drafted post-hearing note for client workspace.",
      billable: true,
    },
  });
  assert.equal(timeEntryResponse.statusCode, 200);
  assert.equal((timeEntryResponse.json() as { timeEntry: { minutes: number } }).timeEntry.minutes, 45);

  const documentResponse = await app.inject({
    method: "GET",
    url: "/v1/documents/doc-farooq-pleading/content",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(documentResponse.statusCode, 200);
  assert.equal(documentResponse.headers["content-type"], "application/pdf");
});

test("product staff can ingest Rawalpindi and LHC Rawalpindi fixture court sources", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03007654321");
  const headers = { authorization: `Bearer ${token}` };

  const rwpMatterResponse = await app.inject({
    method: "POST",
    url: "/v1/matters",
    headers,
    payload: {
      courtId: "rwp-criminal-magisterial",
      rawCaseNumber: "Criminal Revision 77/2026",
      title: "State vs Qasim Ali",
      matterType: "litigation",
      stage: "notice",
      status: "open",
      nextHearingAt: null,
    },
  });
  assert.equal(rwpMatterResponse.statusCode, 200);
  const rwpMatterId = (rwpMatterResponse.json() as { matter: { id: string } }).matter.id;

  const lhcMatterResponse = await app.inject({
    method: "POST",
    url: "/v1/matters",
    headers,
    payload: {
      courtId: "lhc-rawalpindi-bench",
      rawCaseNumber: "W.P. 501/2026",
      title: "Nadia Khan vs Province of Punjab",
      matterType: "litigation",
      stage: "notice",
      status: "open",
      nextHearingAt: null,
    },
  });
  assert.equal(lhcMatterResponse.statusCode, 200);
  const lhcMatterId = (lhcMatterResponse.json() as { matter: { id: string } }).matter.id;

  for (const sourceId of ["source-rwp-district", "source-lhc-rwp"]) {
    const syncResponse = await app.inject({
      method: "POST",
      url: `/v1/court-sources/${sourceId}/sync`,
      headers,
      payload: { listDate: "2026-07-15", listType: "regular" },
    });
    assert.equal(syncResponse.statusCode, 200);
    assert.equal((syncResponse.json() as { courtSource: { status: string } }).courtSource.status, "live");
  }

  const rwpMatter = await app.inject({ method: "GET", url: `/v1/matters/${rwpMatterId}`, headers });
  assert.equal(rwpMatter.statusCode, 200);
  assert.equal((rwpMatter.json() as { matter: { nextHearingAt: string | null } }).matter.nextHearingAt, "2026-07-15");

  const lhcMatter = await app.inject({ method: "GET", url: `/v1/matters/${lhcMatterId}`, headers });
  assert.equal(lhcMatter.statusCode, 200);
  assert.equal((lhcMatter.json() as { matter: { nextHearingAt: string | null } }).matter.nextHearingAt, "2026-07-15");

  const matchesResponse = await app.inject({ method: "GET", url: "/v1/court-matches/review", headers });
  assert.equal(matchesResponse.statusCode, 200);
  const matches = (matchesResponse.json() as { matches: Array<{ matterId: string; courtId: string; state: string }> }).matches;
  assert.ok(matches.some((match) => match.matterId === rwpMatterId && match.courtId === "rwp-criminal-magisterial" && match.state === "auto_matched"));
  assert.ok(matches.some((match) => match.matterId === lhcMatterId && match.courtId === "lhc-rawalpindi-bench" && match.state === "auto_matched"));

  const unmatchedResponse = await app.inject({ method: "GET", url: "/v1/court-matches/unmatched", headers });
  assert.equal(unmatchedResponse.statusCode, 200);
  const unmatched = (unmatchedResponse.json() as { entries: Array<{ courtId: string }> }).entries;
  assert.ok(unmatched.some((entry) => entry.courtId === "rwp-civil-courts"));
  assert.ok(unmatched.some((entry) => entry.courtId === "rwp-family-courts"));
});

test("product staff and client can both post to the matter thread", async () => {
  const { app } = await createProductApp();
  const { token: staffToken } = await login(app, "staff", "03001234567");
  const { token: clientToken } = await login(app, "client", "03005550001");

  const staffPost = await app.inject({
    method: "POST",
    url: "/v1/threads/thread-redtone/messages",
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      body: "Arguments concluded. We are waiting for the reserved order.",
      language: "en",
      deliveryChannel: "in_app",
    },
  });
  assert.equal(staffPost.statusCode, 200);

  const clientPost = await app.inject({
    method: "POST",
    url: "/v1/threads/thread-redtone/messages",
    headers: { authorization: `Bearer ${clientToken}` },
    payload: {
      body: "Please share the next listed date once available.",
      language: "en",
      deliveryChannel: "in_app",
    },
  });
  assert.equal(clientPost.statusCode, 200);

  const messagesResponse = await app.inject({
    method: "GET",
    url: "/v1/threads/thread-redtone/messages",
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(messagesResponse.statusCode, 200);
  const messages = (messagesResponse.json() as { messages: Array<{ body: string }> }).messages;
  assert.ok(messages.some((message) => message.body.includes("Arguments concluded")));
  assert.ok(messages.some((message) => message.body.includes("next listed date")));
  const alerts = await app.inject({
    method: "GET",
    url: "/v1/alerts",
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.ok((alerts.json() as { auditEvents: Array<{ actorType: string; objectId: string }> }).auditEvents.some(
    (event) => event.actorType === "client" && event.objectId === "/v1/threads/:id/messages",
  ));
});

test("product staff can capture a hearing update and advance the matter next date", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");

  const hearingResponse = await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      listedAt: "2026-04-21T10:30:00+05:00",
      outcome: "Order reserved",
      notes: "Court reserved the matter and directed a short note before the next listing.",
      nextDate: "2026-05-19",
      sourceType: "manual_staff",
    },
  });
  assert.equal(hearingResponse.statusCode, 200);
  assert.equal((hearingResponse.json() as { hearing: { outcome: string } }).hearing.outcome, "Order reserved");

  const matterResponse = await app.inject({
    method: "GET",
    url: "/v1/matters/matter-redtone",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(matterResponse.statusCode, 200);
  const matter = (matterResponse.json() as { matter: { nextHearingAt: string | null; hearings: Array<{ outcome: string }> } }).matter;
  assert.equal(matter.nextHearingAt, "2026-05-19");
  assert.ok(matter.hearings.some((hearing) => hearing.outcome === "Order reserved"));
});

test("product refresh rotates the refresh token and keeps the session alive", async () => {
  const { app } = await createProductApp();
  const loginPayload = await login(app, "staff", "03001234567");
  assert.equal(loginPayload.expiresInSeconds, 900);

  const refreshResponse = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: loginPayload.refreshToken },
  });
  assert.equal(refreshResponse.statusCode, 200);
  const refreshed = refreshResponse.json() as { token: string; refreshToken: string };
  assert.notEqual(refreshed.refreshToken, loginPayload.refreshToken);

  const sessionsResponse = await app.inject({
    method: "GET",
    url: "/v1/sessions",
    headers: { authorization: `Bearer ${refreshed.token}` },
  });
  assert.equal(sessionsResponse.statusCode, 200);
  const sessions = (sessionsResponse.json() as { sessions: Array<{ revokedAt: string | null }> }).sessions;
  assert.ok(sessions.some((session) => session.revokedAt === null));

  const staleRefresh = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: loginPayload.refreshToken },
  });
  assert.equal(staleRefresh.statusCode, 401);
});

test("product staff client crm and reports endpoints return firm-scoped aggregates", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");

  const clientsResponse = await app.inject({
    method: "GET",
    url: "/v1/clients",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(clientsResponse.statusCode, 200);
  const clients = (clientsResponse.json() as {
    clients: Array<{ id: string; matterCount: number; outstandingTotal: number }>;
  }).clients;
  assert.ok(clients.some((client) => client.id === "client-redtone" && client.matterCount >= 1));

  const clientDetailResponse = await app.inject({
    method: "GET",
    url: "/v1/clients/client-redtone",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(clientDetailResponse.statusCode, 200);
  const clientDetail = clientDetailResponse.json() as {
    client: { id: string };
    matters: Array<{ id: string }>;
    invoices: Array<{ id: string }>;
  };
  assert.equal(clientDetail.client.id, "client-redtone");
  assert.ok(clientDetail.matters.some((matter) => matter.id === "matter-redtone"));
  assert.ok(clientDetail.invoices.some((invoice) => invoice.id === "invoice-redtone"));

  const reportResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/overview",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(reportResponse.statusCode, 200);
  const report = reportResponse.json() as {
    metrics: { openMatters: number; outstandingInvoiceTotal: number };
    mattersByStage: Array<{ stage: string; count: number }>;
  };
  assert.ok(report.metrics.openMatters >= 2);
  assert.ok(report.metrics.outstandingInvoiceTotal >= 85000);
  assert.ok(report.mattersByStage.some((entry) => entry.stage === "arguments"));
});

test("product staff magic-link auth creates a revocable session", async () => {
  const { app } = await createProductApp();

  const requestResponse = await app.inject({
    method: "POST",
    url: "/auth/staff/magic-link/request",
    payload: { email: "ahmed@hassanco.pk" },
  });
  assert.equal(requestResponse.statusCode, 200);
  const requestPayload = requestResponse.json() as { devMagicLink: string };
  const magicLink = new URL(requestPayload.devMagicLink);

  const verifyResponse = await app.inject({
    method: "GET",
    url: `/auth/staff/magic-link/verify?token=${magicLink.searchParams.get("token")}`,
  });
  assert.equal(verifyResponse.statusCode, 200);
  const issued = verifyResponse.json() as { token: string; session: { authMethod: string } };
  assert.equal(issued.session.authMethod, "staff_magic_link");

  const sessionsResponse = await app.inject({
    method: "GET",
    url: "/v1/sessions",
    headers: { authorization: `Bearer ${issued.token}` },
  });
  assert.equal(sessionsResponse.statusCode, 200);
  const sessions = (sessionsResponse.json() as { sessions: Array<{ authMethod: string; revokedAt: string | null }> }).sessions;
  assert.ok(sessions.some((session) => session.authMethod === "staff_magic_link" && session.revokedAt === null));

  const logoutResponse = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: { authorization: `Bearer ${issued.token}` },
  });
  assert.equal(logoutResponse.statusCode, 200);

  const meAfterLogout = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${issued.token}` },
  });
  assert.equal(meAfterLogout.statusCode, 401);
});

test("product roles, memberships, document patching, and alert reads work", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");

  const rolesResponse = await app.inject({
    method: "GET",
    url: "/v1/roles",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(rolesResponse.statusCode, 200);
  const roles = (rolesResponse.json() as { roles: Array<{ id: string }> }).roles;
  assert.ok(roles.some((role) => role.id === "owner"));

  const membershipsResponse = await app.inject({
    method: "GET",
    url: "/v1/firms/firm-hassan-co/memberships",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(membershipsResponse.statusCode, 200);
  const memberships = (membershipsResponse.json() as { memberships: Array<{ membership: { id: string } }> }).memberships;
  assert.equal(memberships.length, 3);

  const permissionsResponse = await app.inject({
    method: "PATCH",
    url: "/v1/memberships/membership-assistant/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permissions: ["matters.read", "documents.read", "calendar.read"] },
  });
  assert.equal(permissionsResponse.statusCode, 200);
  assert.deepEqual(
    (permissionsResponse.json() as { membership: { permissions: string[] } }).membership.permissions,
    ["matters.read", "documents.read", "calendar.read"],
  );

  const documentPatch = await app.inject({
    method: "PATCH",
    url: "/v1/documents/doc-farooq-pleading",
    headers: { authorization: `Bearer ${token}` },
    payload: { title: "updated-plaint-summary.pdf", portalVisible: false },
  });
  assert.equal(documentPatch.statusCode, 200);
  const patchedDocument = (documentPatch.json() as { document: { title: string; portalVisible: boolean } }).document;
  assert.equal(patchedDocument.title, "updated-plaint-summary.pdf");
  assert.equal(patchedDocument.portalVisible, false);

  const alertPatch = await app.inject({
    method: "PATCH",
    url: "/v1/alerts/alert-redtone",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(alertPatch.statusCode, 200);
  assert.ok((alertPatch.json() as { alert: { readAt: string | null } }).alert.readAt);
});

test("portal links, scoped portal OTP, document download, and ingestion run reads work", async () => {
  const { app } = await createProductApp();
  const { token: staffToken } = await login(app, "staff", "03001234567");

  const portalLinkResponse = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { matterId: "matter-redtone" },
  });
  assert.equal(portalLinkResponse.statusCode, 200);
  const portalPayload = portalLinkResponse.json() as { token: string };
  const clientBearer = await verifyPortal(app, portalPayload.token);

  const portalCases = await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${portalPayload.token}`,
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(portalCases.statusCode, 200);
  const cases = (portalCases.json() as { cases: Array<{ id: string }> }).cases;
  assert.ok(cases.some((record) => record.id === "matter-redtone"));
  assert.ok(cases.some((record) => record.id === "matter-farooq"));

  const portalCase = await app.inject({
    method: "GET",
    url: `/v1/portal/cases/matter-redtone?token=${portalPayload.token}`,
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(portalCase.statusCode, 200);
  const portalDetail = portalCase.json() as { case: { documents: Array<{ id: string }> } };
  assert.ok(portalDetail.case.documents.some((document) => document.id === "doc-redtone-order"));

  const portalDownload = await app.inject({
    method: "GET",
    url: `/v1/documents/doc-redtone-order/download?token=${portalPayload.token}`,
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(portalDownload.statusCode, 200);
  assert.equal(portalDownload.headers["content-type"], "application/pdf");

  const ingestionRuns = await app.inject({
    method: "GET",
    url: "/v1/ingestion-runs",
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(ingestionRuns.statusCode, 200);
  const latestRuns = (ingestionRuns.json() as { ingestionRuns: Array<{ id: string; status: string }> }).ingestionRuns;
  assert.ok(latestRuns.length >= 3);

  const reconcile = await app.inject({
    method: "POST",
    url: `/v1/ingestion-runs/${latestRuns[0].id}/reconcile`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { note: "This global mutation is not exposed to pilot users." },
  });
  assert.equal(reconcile.statusCode, 404);

  const clientMe = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(clientMe.statusCode, 403);
});

test("staff mutations cannot cross workspace boundaries", async () => {
  const { app, productDbPath } = await createProductApp();
  seedSecondWorkspace(productDbPath);
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };
  const secondHeaders = { authorization: `Bearer ${(await login(app, "staff", "03009999999")).token}` };
  const otherImport = await app.inject({
    method: "POST",
    url: "/v1/matters/imports/preview",
    headers: secondHeaders,
    payload: {
      csv: [
        "courtId,rawCaseNumber,title,matterType,stage,nextHearingAt",
        'ihc,W.P. 990/2026,"Other workspace import",litigation,notice,2026-07-01',
      ].join("\n"),
    },
  });
  assert.equal(otherImport.statusCode, 200);
  const otherImportId = (otherImport.json() as { importJob: { id: string } }).importJob.id;

  const attempts = [
    app.inject({ method: "PATCH", url: "/v1/matters/matter-other", headers, payload: { title: "stolen" } }),
    app.inject({
      method: "POST",
      url: "/v1/matters/matter-other/hearings",
      headers,
      payload: { outcome: "stolen", notes: "stolen" },
    }),
    app.inject({
      method: "POST",
      url: "/v1/matters/matter-other/parties",
      headers,
      payload: { partyType: "petitioner", displayName: "stolen" },
    }),
    app.inject({
      method: "PATCH",
      url: "/v1/matters/matter-other/parties/party-other",
      headers,
      payload: { displayName: "stolen" },
    }),
    app.inject({ method: "DELETE", url: "/v1/matters/matter-other/parties/party-other", headers }),
    app.inject({ method: "PATCH", url: "/v1/documents/doc-other", headers, payload: { title: "stolen.pdf" } }),
    app.inject({ method: "PATCH", url: "/v1/documents/doc-redtone-order", headers, payload: { matterId: "matter-other" } }),
    app.inject({
      method: "POST",
      url: "/v1/documents",
      headers,
      payload: { matterId: "matter-other", type: "note", title: "stolen", mimeType: "text/plain" },
    }),
    app.inject({ method: "POST", url: "/v1/documents/doc-redtone-order/link", headers, payload: { matterId: "matter-other" } }),
    app.inject({
      method: "POST",
      url: "/v1/threads/thread-other/messages",
      headers,
      payload: { body: "stolen", language: "en", deliveryChannel: "in_app" },
    }),
    app.inject({ method: "PATCH", url: "/v1/clients/client-other", headers, payload: { displayName: "stolen" } }),
    app.inject({ method: "DELETE", url: "/v1/clients/client-other", headers }),
    app.inject({
      method: "PATCH",
      url: "/v1/clients/client-other/notifications/preferences",
      headers,
      payload: { emailEnabled: false, smsEnabled: true, optedOut: false },
    }),
    app.inject({ method: "POST", url: "/v1/matters/matter-redtone/clients", headers, payload: { clientId: "client-other" } }),
    app.inject({ method: "DELETE", url: "/v1/matters/matter-other/clients/client-other", headers }),
    app.inject({
      method: "POST",
      url: "/v1/time-entries",
      headers,
      payload: { matterId: "matter-other", startedAt: createdAtForTest(), minutes: 15, narrative: "stolen", billable: true },
    }),
    app.inject({ method: "PATCH", url: "/v1/invoices/invoice-other", headers, payload: { total: 1 } }),
    app.inject({
      method: "POST",
      url: "/v1/invoices",
      headers,
      payload: { clientAccountId: "client-redtone", matterId: "matter-other", status: "draft", total: 1 },
    }),
    app.inject({ method: "PATCH", url: "/v1/memberships/membership-other", headers, payload: { officeLabel: "stolen" } }),
    app.inject({ method: "PATCH", url: "/v1/memberships/membership-other/permissions", headers, payload: { permissions: ["*"] } }),
    app.inject({
      method: "POST",
      url: "/v1/firms/firm-other/invitations",
      headers,
      payload: { phone: "03001119999", role: "lawyer" },
    }),
    app.inject({ method: "POST", url: `/v1/matters/imports/${otherImportId}/confirm`, headers }),
    app.inject({ method: "POST", url: "/v1/portal/links", headers, payload: { matterId: "matter-other" } }),
    app.inject({ method: "PATCH", url: "/v1/alerts/alert-other", headers, payload: {} }),
    app.inject({ method: "PATCH", url: "/v1/court-matches/match-other", headers, payload: { state: "approved" } }),
    app.inject({ method: "POST", url: "/v1/court-matches/unmatched/cause-other/link", headers, payload: { matterId: "matter-other" } }),
  ];

  for (const response of await Promise.all(attempts)) {
    assert.ok([403, 404].includes(response.statusCode), `${response.statusCode}: ${response.body}`);
  }

  const hiddenReads = await Promise.all([
    app.inject({ method: "GET", url: "/v1/matters/matter-other", headers }),
    app.inject({ method: "GET", url: "/v1/documents/doc-other", headers }),
    app.inject({ method: "GET", url: "/v1/documents/doc-other/content", headers }),
    app.inject({ method: "GET", url: "/v1/documents/doc-other/download", headers }),
    app.inject({ method: "GET", url: "/v1/clients/client-other", headers }),
    app.inject({ method: "GET", url: "/v1/clients/client-other/notifications/preferences", headers }),
    app.inject({ method: "GET", url: "/v1/firms/firm-other/memberships", headers }),
    app.inject({ method: "GET", url: "/v1/firms/firm-other", headers }),
    app.inject({ method: "GET", url: `/v1/matters/imports/${otherImportId}`, headers }),
    app.inject({ method: "GET", url: `/v1/matters/imports/${otherImportId}/rejected`, headers }),
  ]);
  for (const response of hiddenReads) {
    assert.ok([403, 404].includes(response.statusCode), `${response.statusCode}: ${response.body}`);
  }
  const search = await app.inject({ method: "GET", url: "/v1/search?q=Other", headers });
  assert.deepEqual((search.json() as { hits: unknown[] }).hits, []);
  const invoices = await app.inject({ method: "GET", url: "/v1/invoices", headers });
  assert.ok(!(invoices.json() as { invoices: Array<{ id: string }> }).invoices.some((invoice) => invoice.id === "invoice-other"));
  const hearings = await app.inject({ method: "GET", url: "/v1/matters/matter-other/hearings", headers });
  assert.deepEqual((hearings.json() as { hearings: unknown[] }).hearings, []);
  const messages = await app.inject({ method: "GET", url: "/v1/threads/thread-other/messages", headers });
  assert.deepEqual((messages.json() as { messages: unknown[] }).messages, []);
  const documents = await app.inject({ method: "GET", url: "/v1/documents?matterId=matter-other", headers });
  assert.deepEqual((documents.json() as { documents: unknown[] }).documents, []);
  const threads = await app.inject({ method: "GET", url: "/v1/threads", headers });
  assert.ok(!(threads.json() as { threads: Array<{ id: string }> }).threads.some((thread) => thread.id === "thread-other"));
  const calendar = await app.inject({ method: "GET", url: "/v1/calendar", headers });
  assert.ok(!(calendar.json() as { items: Array<{ id: string }> }).items.some((item) => item.id === "calendar-other"));
  const alerts = await app.inject({ method: "GET", url: "/v1/alerts", headers });
  assert.ok(!(alerts.json() as { alerts: Array<{ id: string }> }).alerts.some((alert) => alert.id === "alert-other"));
  const courtMatches = await app.inject({ method: "GET", url: "/v1/court-matches/review", headers });
  assert.ok(!(courtMatches.json() as { matches: Array<{ id: string }> }).matches.some((match) => match.id === "match-other"));
  const notifications = await app.inject({ method: "GET", url: "/v1/notifications/history", headers });
  assert.ok(!(notifications.json() as { notifications: Array<{ id: string }> }).notifications.some((job) => job.id === "notification-other"));
  const clients = await app.inject({ method: "GET", url: "/v1/clients", headers });
  assert.ok(!(clients.json() as { clients: Array<{ id: string }> }).clients.some((client) => client.id === "client-other"));
  const conflicts = await app.inject({ method: "GET", url: "/v1/calendar/conflicts", headers });
  assert.ok(!(conflicts.json() as { items: Array<{ id: string }> }).items.some((item) => item.id === "calendar-other"));
});

test("the same client phone remains isolated across firms and portal OTP selects the exact client", async () => {
  const { app, productDbPath } = await createProductApp();
  seedSecondWorkspace(productDbPath);
  const sharedPhone = "03007778888";
  const firstHeaders = { authorization: `Bearer ${(await login(app, "staff", "03001234567")).token}` };
  const secondHeaders = { authorization: `Bearer ${(await login(app, "staff", "03009999999")).token}` };

  const firstClientResponse = await app.inject({
    method: "POST",
    url: "/v1/clients",
    headers: firstHeaders,
    payload: { phone: sharedPhone, displayName: "First Firm Client", language: "en" },
  });
  const secondClientResponse = await app.inject({
    method: "POST",
    url: "/v1/clients",
    headers: secondHeaders,
    payload: { phone: sharedPhone, displayName: "Second Firm Client", language: "en" },
  });
  assert.equal(firstClientResponse.statusCode, 200);
  assert.equal(secondClientResponse.statusCode, 200);
  const firstClientId = (firstClientResponse.json() as { client: { id: string } }).client.id;
  const secondClientId = (secondClientResponse.json() as { client: { id: string } }).client.id;
  assert.notEqual(firstClientId, secondClientId);

  const ambiguousOtp = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "client", phone: sharedPhone },
  });
  assert.deepEqual(ambiguousOtp.json(), { ok: true, expiresAt: null });

  async function createPortal(
    headers: Record<string, string>,
    clientId: string,
    rawCaseNumber: string,
    title: string,
  ): Promise<{ matterId: string; portalToken: string }> {
    const matterResponse = await app.inject({
      method: "POST",
      url: "/v1/matters",
      headers,
      payload: { courtId: "ihc", rawCaseNumber, title, matterType: "litigation", stage: "notice", status: "open" },
    });
    assert.equal(matterResponse.statusCode, 200);
    const matterId = (matterResponse.json() as { matter: { id: string } }).matter.id;
    assert.equal((await app.inject({
      method: "POST",
      url: `/v1/matters/${matterId}/clients`,
      headers,
      payload: { clientId },
    })).statusCode, 200);
    const portalResponse = await app.inject({
      method: "POST",
      url: "/v1/portal/links",
      headers,
      payload: { matterId },
    });
    assert.equal(portalResponse.statusCode, 200);
    return { matterId, portalToken: (portalResponse.json() as { token: string }).token };
  }

  const firstPortal = await createPortal(firstHeaders, firstClientId, "W.P. 811/2026", "First firm portal matter");
  const secondPortal = await createPortal(secondHeaders, secondClientId, "W.P. 812/2026", "Second firm portal matter");
  const firstPortalAccessToken = await verifyPortal(app, firstPortal.portalToken);
  const secondPortalAccessToken = await verifyPortal(app, secondPortal.portalToken);

  const firstMatters = await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${firstPortal.portalToken}`,
    headers: { authorization: `Bearer ${firstPortalAccessToken}` },
  });
  const secondMatters = await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${secondPortal.portalToken}`,
    headers: { authorization: `Bearer ${secondPortalAccessToken}` },
  });
  assert.deepEqual((firstMatters.json() as { cases: Array<{ id: string }> }).cases.map((matter) => matter.id), [firstPortal.matterId]);
  assert.deepEqual((secondMatters.json() as { cases: Array<{ id: string }> }).cases.map((matter) => matter.id), [secondPortal.matterId]);
});

test("a portal token exposes all matters linked to its client", async () => {
  const { app } = await createProductApp();

  const { token } = await login(app, "staff", "03001234567");
  const portalLinkResponse = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers: { authorization: `Bearer ${token}` },
    payload: { matterId: "matter-redtone" },
  });
  assert.equal(portalLinkResponse.statusCode, 200);
  const portalToken = (portalLinkResponse.json() as { token: string }).token;
  const beforeOtp = await app.inject({ method: "GET", url: `/v1/portal/cases?token=${portalToken}` });
  assert.equal(beforeOtp.statusCode, 401);
  const portalAccessToken = await verifyPortal(app, portalToken);

  const rawTokenAfterOtp = await app.inject({ method: "GET", url: `/v1/portal/cases?token=${portalToken}` });
  assert.equal(rawTokenAfterOtp.statusCode, 401);

  const listResponse = await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${portalToken}`,
    headers: { authorization: `Bearer ${portalAccessToken}` },
  });
  assert.deepEqual(
    (listResponse.json() as { cases: Array<{ id: string }> }).cases.map((matter) => matter.id),
    ["matter-redtone", "matter-farooq"],
  );

  const linkedSecondMatter = await app.inject({
    method: "GET",
    url: `/v1/portal/cases/matter-farooq?token=${portalToken}`,
    headers: { authorization: `Bearer ${portalAccessToken}` },
  });
  assert.equal(linkedSecondMatter.statusCode, 200);

  const fullClientWorkspace = await app.inject({
    method: "GET",
    url: "/v1/clients/me/matters",
    headers: { authorization: `Bearer ${portalAccessToken}` },
  });
  assert.equal(fullClientWorkspace.statusCode, 403);
});

test("portal link creation requires an explicit client when a matter has multiple clients", async () => {
  const { app } = await createProductApp();
  const headers = { authorization: `Bearer ${(await login(app, "staff", "03001234567")).token}` };
  const secondClient = await app.inject({
    method: "POST",
    url: "/v1/clients",
    headers,
    payload: { phone: "03007773333", displayName: "Second Portal Client", language: "en" },
  });
  const secondClientId = (secondClient.json() as { client: { id: string } }).client.id;
  assert.equal((await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/clients",
    headers,
    payload: { clientId: secondClientId },
  })).statusCode, 200);

  const ambiguous = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers,
    payload: { matterId: "matter-redtone" },
  });
  assert.equal(ambiguous.statusCode, 404);

  const selected = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers,
    payload: { matterId: "matter-redtone", clientId: secondClientId },
  });
  assert.equal(selected.statusCode, 200);
  const selectedPortalToken = (selected.json() as { token: string }).token;
  const portalAccessToken = await verifyPortal(app, selectedPortalToken);
  const me = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${portalAccessToken}` },
  });
  assert.equal(me.statusCode, 403);
  const selectedMatter = await app.inject({
    method: "GET",
    url: `/v1/portal/cases/matter-redtone?token=${selectedPortalToken}`,
    headers: { authorization: `Bearer ${portalAccessToken}` },
  });
  assert.equal(selectedMatter.statusCode, 200);
});

test("unlinking a client revokes only that matter access and its pending notifications", async () => {
  const { app, productDbPath } = await createProductApp();
  const staffHeaders = { authorization: `Bearer ${(await login(app, "staff", "03001234567")).token}` };
  const clientHeaders = { authorization: `Bearer ${(await login(app, "client", "03005550001")).token}` };

  assert.equal((await app.inject({
    method: "POST",
    url: "/v1/matters/matter-farooq/clients",
    headers: staffHeaders,
    payload: { clientId: "client-redtone" },
  })).statusCode, 200);
  const portal = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers: staffHeaders,
    payload: { matterId: "matter-redtone", clientId: "client-redtone" },
  });
  const portalToken = (portal.json() as { token: string }).token;
  const portalAccessToken = await verifyPortal(app, portalToken);
  assert.equal((await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers: staffHeaders,
    payload: { outcome: "Adjourned", notes: "Pending client update.", nextDate: "2030-03-10" },
  })).statusCode, 200);

  const unlinked = await app.inject({
    method: "DELETE",
    url: "/v1/matters/matter-redtone/clients/client-redtone",
    headers: staffHeaders,
  });
  assert.equal(unlinked.statusCode, 200);
  assert.deepEqual(unlinked.json(), { ok: true });
  assert.equal((await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${portalToken}`,
    headers: { authorization: `Bearer ${portalAccessToken}` },
  })).statusCode, 404);
  const clientMatters = await app.inject({ method: "GET", url: "/v1/clients/me/matters", headers: clientHeaders });
  assert.deepEqual(
    (clientMatters.json() as { matters: Array<{ id: string }> }).matters.map((matter) => matter.id),
    ["matter-farooq"],
  );

  const db = new DatabaseSync(productDbPath);
  const pending = db.prepare(`
    SELECT COUNT(*) AS count FROM notification_jobs
    WHERE actor_id = 'client-redtone' AND json_extract(payload_json, '$.matterId') = 'matter-redtone'
      AND status IN ('pending', 'retrying')
  `).get() as { count: number };
  db.close();
  assert.equal(pending.count, 0);
});

test("archiving a client revokes sessions, portal access, and future OTP login", async () => {
  const { app } = await createProductApp();
  const staffHeaders = { authorization: `Bearer ${(await login(app, "staff", "03001234567")).token}` };
  const clientToken = (await login(app, "client", "03005550001")).token;
  const portalLink = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers: staffHeaders,
    payload: { matterId: "matter-redtone" },
  });
  const portalToken = (portalLink.json() as { token: string }).token;
  const portalAccessToken = await verifyPortal(app, portalToken);

  const archived = await app.inject({
    method: "DELETE",
    url: "/v1/clients/client-redtone",
    headers: staffHeaders,
  });
  assert.equal(archived.statusCode, 200);
  assert.equal((archived.json() as { client: { status: string } }).client.status, "archived");
  assert.equal((await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${portalToken}`,
    headers: { authorization: `Bearer ${portalAccessToken}` },
  })).statusCode, 404);
  assert.equal((await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${clientToken}` },
  })).statusCode, 401);
  assert.deepEqual((await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "client", phone: "03005550001" },
  })).json(), { ok: true, expiresAt: null });
});

test("an invited solo lawyer can register and receives a personal workspace", async () => {
  const { app } = await createProductApp();
  const inviteResponse = await app.inject({
    method: "POST",
    url: "/v1/pilot/invites",
    headers: { "x-pilot-admin-secret": "pilot-test-secret" },
    payload: { phone: "+92 300 7777777", email: "pilot@example.test" },
  });
  assert.equal(inviteResponse.statusCode, 200);

  const otpResponse = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "staff", phone: "03007777777" },
  });
  assert.equal(otpResponse.statusCode, 200);
  const devCode = (otpResponse.json() as { devCode: string }).devCode;

  const registerResponse = await app.inject({
    method: "POST",
    url: "/v1/auth/staff/register",
    payload: {
      phone: "03007777777",
      code: devCode,
      displayName: "Pilot Lawyer",
      email: "pilot@example.test",
      firmName: "Pilot Lawyer Chambers",
      primaryCity: "Islamabad",
    },
  });
  assert.equal(registerResponse.statusCode, 200);
  const registration = registerResponse.json() as { token: string; profile: { firm: { name: string }; staffMembership: { role: string } } };
  assert.equal(registration.profile.firm.name, "Pilot Lawyer Chambers");
  assert.equal(registration.profile.staffMembership.role, "owner");

  const mattersResponse = await app.inject({
    method: "GET",
    url: "/v1/matters",
    headers: { authorization: `Bearer ${registration.token}` },
  });
  assert.deepEqual((mattersResponse.json() as { matters: unknown[] }).matters, []);

  const alertsResponse = await app.inject({
    method: "GET",
    url: "/v1/alerts",
    headers: { authorization: `Bearer ${registration.token}` },
  });
  const auditEventTypes = (alertsResponse.json() as { auditEvents: Array<{ eventType: string }> }).auditEvents.map(
    (event) => event.eventType,
  );
  assert.ok(auditEventTypes.includes("workspace.registered"));
  assert.ok(auditEventTypes.includes("auth.session.created"));
});

test("controlled pilot journey runs from invited signup through post-hearing client update", async () => {
  const { app } = await createProductApp();
  const lawyerPhone = "03007776666";
  const clientPhone = "03008887777";

  assert.equal((await app.inject({
    method: "POST",
    url: "/v1/pilot/invites",
    headers: { "x-pilot-admin-secret": "pilot-test-secret" },
    payload: { phone: lawyerPhone, email: "journey-lawyer@example.test" },
  })).statusCode, 200);
  const otp = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/request",
    payload: { actorType: "staff", phone: lawyerPhone },
  });
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/staff/register",
    payload: {
      phone: lawyerPhone,
      code: (otp.json() as { devCode: string }).devCode,
      displayName: "Journey Lawyer",
      email: "journey-lawyer@example.test",
      firmName: "Journey Lawyer Chambers",
      primaryCity: "Islamabad",
    },
  });
  assert.equal(registration.statusCode, 200);
  const staffHeaders = { authorization: `Bearer ${(registration.json() as { token: string }).token}` };

  const matterResponse = await app.inject({
    method: "POST",
    url: "/v1/matters",
    headers: staffHeaders,
    payload: {
      courtId: "ihc",
      rawCaseNumber: "W.P. 606/2026",
      title: "Controlled pilot journey",
      matterType: "litigation",
      stage: "notice",
      status: "open",
      nextHearingAt: "2026-07-01",
    },
  });
  assert.equal(matterResponse.statusCode, 200);
  const matterId = (matterResponse.json() as { matter: { id: string } }).matter.id;

  const clientResponse = await app.inject({
    method: "POST",
    url: "/v1/clients",
    headers: staffHeaders,
    payload: { phone: clientPhone, displayName: "Journey Client", language: "en" },
  });
  assert.equal(clientResponse.statusCode, 200);
  const clientId = (clientResponse.json() as { client: { id: string } }).client.id;
  assert.equal((await app.inject({
    method: "POST",
    url: `/v1/matters/${matterId}/clients`,
    headers: staffHeaders,
    payload: { clientId },
  })).statusCode, 200);
  assert.equal((await app.inject({
    method: "PATCH",
    url: `/v1/clients/${clientId}/notifications/preferences`,
    headers: staffHeaders,
    payload: { emailEnabled: false, smsEnabled: true, optedOut: false },
  })).statusCode, 200);

  const hearingResponse = await app.inject({
    method: "POST",
    url: `/v1/matters/${matterId}/hearings`,
    headers: staffHeaders,
    payload: {
      listedAt: "2026-06-30T09:00:00+05:00",
      outcome: "Adjourned",
      notes: "Client informed after hearing.",
      nextDate: "2026-07-15",
    },
  });
  assert.equal(hearingResponse.statusCode, 200);

  const detail = await app.inject({ method: "GET", url: `/v1/matters/${matterId}`, headers: staffHeaders });
  const threadId = (detail.json() as { matter: { thread: { id: string } } }).matter.thread.id;
  assert.equal((await app.inject({
    method: "POST",
    url: `/v1/threads/${threadId}/messages`,
    headers: staffHeaders,
    payload: { body: "Your hearing was adjourned to July 15.", language: "en", deliveryChannel: "in_app" },
  })).statusCode, 200);

  const history = await app.inject({ method: "GET", url: "/v1/notifications/history", headers: staffHeaders });
  assert.ok((history.json() as { notifications: Array<{ templateKey: string }> }).notifications.some((job) => job.templateKey === "post_hearing_update"));

  const portalLink = await app.inject({
    method: "POST",
    url: "/v1/portal/links",
    headers: staffHeaders,
    payload: { matterId },
  });
  assert.equal(portalLink.statusCode, 200);
  const portalToken = (portalLink.json() as { token: string }).token;
  assert.equal((await app.inject({ method: "GET", url: `/v1/portal/cases?token=${portalToken}` })).statusCode, 401);
  const clientBearer = await verifyPortal(app, portalToken);
  const portalCases = await app.inject({
    method: "GET",
    url: `/v1/portal/cases?token=${portalToken}`,
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.deepEqual((portalCases.json() as { cases: Array<{ id: string }> }).cases.map((matter) => matter.id), [matterId]);

  const clientMatters = await app.inject({
    method: "GET",
    url: "/v1/clients/me/matters",
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(clientMatters.statusCode, 403);
  const clientMessages = await app.inject({
    method: "GET",
    url: `/v1/threads/${threadId}/messages`,
    headers: { authorization: `Bearer ${clientBearer}` },
  });
  assert.equal(clientMessages.statusCode, 403);
});

test("matter CSV import previews validation and duplicates before confirmed import", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };
  const csv = [
    "courtId,rawCaseNumber,title,matterType,stage,nextHearingAt",
    'ihc,W.P. 2076/2019,"Existing matter",litigation,notice,2026-06-20',
    'ihc,W.P. 808/2026,"New imported matter",litigation,notice,2026-06-21',
    'ihc,,"Rejected matter",litigation,notice,not-a-date',
    'ihc,W.P. 809/2026,"Impossible date",litigation,notice,2026-02-31',
  ].join("\n");

  const previewResponse = await app.inject({
    method: "POST",
    url: "/v1/matters/imports/preview",
    headers,
    payload: { csv },
  });
  assert.equal(previewResponse.statusCode, 200);
  const preview = (previewResponse.json() as { importJob: { id: string; acceptedRows: number; rejectedRows: number } }).importJob;
  assert.equal(preview.acceptedRows, 1);
  assert.equal(preview.rejectedRows, 3);

  const confirmResponse = await app.inject({
    method: "POST",
    url: `/v1/matters/imports/${preview.id}/confirm`,
    headers,
  });
  assert.equal(confirmResponse.statusCode, 200);
  const mattersResponse = await app.inject({ method: "GET", url: "/v1/matters", headers });
  assert.ok((mattersResponse.json() as { matters: Array<{ normalizedCaseNumber: string }> }).matters.some((matter) => matter.normalizedCaseNumber === "WRIT PETITION 808/2026"));
});

test("notification preferences and hearing update jobs are persisted", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };

  const preferenceResponse = await app.inject({
    method: "PATCH",
    url: "/v1/notifications/preferences",
    headers,
    payload: { emailEnabled: true, smsEnabled: false, optedOut: false },
  });
  assert.equal(preferenceResponse.statusCode, 200);
  assert.equal((preferenceResponse.json() as { preference: { smsEnabled: boolean } }).preference.smsEnabled, false);

  await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers,
    payload: { outcome: "Adjourned", notes: "Client update queued.", nextDate: "2026-06-30" },
  });
  const historyResponse = await app.inject({ method: "GET", url: "/v1/notifications/history", headers });
  assert.equal(historyResponse.statusCode, 200);
  assert.ok((historyResponse.json() as { notifications: Array<{ templateKey: string }> }).notifications.some((job) => job.templateKey === "post_hearing_update"));
});

test("manual next dates stay synchronized with calendar conflicts", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };
  const conflictDate = "2030-01-20";

  async function createMatter(rawCaseNumber: string, courtId: string) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/matters",
      headers,
      payload: {
        courtId,
        rawCaseNumber,
        title: `${rawCaseNumber} calendar test`,
        matterType: "litigation",
        stage: "new",
        status: "open",
        nextHearingAt: conflictDate,
      },
    });
    assert.equal(response.statusCode, 200);
    return (response.json() as { matter: { id: string; leadLawyerId: string | null } }).matter;
  }

  const first = await createMatter("W.P. 9101/2030", "ihc");
  const second = await createMatter("W.P. 9102/2030", "ihc");
  assert.ok(first.leadLawyerId);
  assert.equal(second.leadLawyerId, first.leadLawyerId);

  let items = (await app.inject({ method: "GET", url: "/v1/calendar", headers })).json() as {
    items: Array<{ matterId: string; sourceType: string; conflictState: string }>;
  };
  assert.deepEqual(
    items.items.filter((item) => [first.id, second.id].includes(item.matterId)).map((item) => item.conflictState),
    ["none", "none"],
  );

  assert.equal((await app.inject({
    method: "PATCH",
    url: `/v1/matters/${second.id}`,
    headers,
    payload: { courtId: "rawalpindi-district" },
  })).statusCode, 200);
  items = (await app.inject({ method: "GET", url: "/v1/calendar", headers })).json() as typeof items;
  assert.deepEqual(
    items.items.filter((item) => [first.id, second.id].includes(item.matterId)).map((item) => item.conflictState),
    ["possible", "possible"],
  );

  assert.equal((await app.inject({
    method: "PATCH",
    url: `/v1/matters/${second.id}`,
    headers,
    payload: { nextHearingAt: null },
  })).statusCode, 200);
  items = (await app.inject({ method: "GET", url: "/v1/calendar", headers })).json() as typeof items;
  assert.deepEqual(
    items.items.filter((item) => item.matterId === first.id).map((item) => item.conflictState),
    ["none"],
  );
  assert.ok(!items.items.some((item) => item.matterId === second.id && item.sourceType === "manual_staff"));

  assert.equal((await app.inject({
    method: "POST",
    url: `/v1/matters/${second.id}/hearings`,
    headers,
    payload: { outcome: "Adjourned", notes: "Manual date recorded.", nextDate: "2030-02-10" },
  })).statusCode, 200);
  items = (await app.inject({ method: "GET", url: "/v1/calendar", headers })).json() as typeof items;
  assert.ok(items.items.some((item) => item.matterId === second.id && item.sourceType === "manual_staff"));
});

test("client reminders require recorded SMS consent", async () => {
  const { app } = await createProductApp();
  const { token } = await login(app, "staff", "03001234567");
  const headers = { authorization: `Bearer ${token}` };
  const created = await app.inject({
    method: "POST",
    url: "/v1/clients",
    headers,
    payload: { phone: "03007774444", displayName: "Consent Test Client", language: "en" },
  });
  const clientId = (created.json() as { client: { id: string } }).client.id;
  assert.equal((await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/clients",
    headers,
    payload: { clientId },
  })).statusCode, 200);

  await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers,
    payload: { outcome: "Adjourned", notes: "No consent yet.", nextDate: "2026-07-01" },
  });
  let jobs = (await app.inject({ method: "GET", url: "/v1/notifications/history", headers })).json() as {
    notifications: Array<{ actorId: string; templateKey: string }>;
  };
  assert.ok(!jobs.notifications.some((job) => job.actorId === clientId && job.templateKey === "post_hearing_update"));

  assert.equal((await app.inject({
    method: "PATCH",
    url: `/v1/clients/${clientId}/notifications/preferences`,
    headers,
    payload: { emailEnabled: false, smsEnabled: true, optedOut: false },
  })).statusCode, 200);
  await app.inject({
    method: "POST",
    url: "/v1/matters/matter-redtone/hearings",
    headers,
    payload: { outcome: "Adjourned", notes: "Consent recorded.", nextDate: "2026-07-15" },
  });
  jobs = (await app.inject({ method: "GET", url: "/v1/notifications/history", headers })).json() as typeof jobs;
  assert.ok(jobs.notifications.some((job) => job.actorId === clientId && job.templateKey === "post_hearing_update"));
});

function createdAtForTest(): string {
  return "2026-06-11T12:00:00+05:00";
}
