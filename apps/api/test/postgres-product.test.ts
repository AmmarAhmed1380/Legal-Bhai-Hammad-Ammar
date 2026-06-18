import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import Fastify from "fastify";
import { Pool } from "pg";

import { registerProductRoutes } from "../src/lib/product-api.js";
import { createPostgresProductStore } from "../src/lib/postgres-product-store.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL pilot runtime migrates and isolates workspaces", { skip: !testDatabaseUrl }, async () => {
  const schema = `legalbahi_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const admin = new Pool({ connectionString: testDatabaseUrl });
  const client = await admin.connect();
  const previousOptions = process.env.POSTGRES_OPTIONS;
  const previousJwtSecret = process.env.JWT_SECRET;
  let store: ReturnType<typeof createPostgresProductStore> | null = null;
  let app: ReturnType<typeof Fastify> | null = null;

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    const migrationsDirectory = resolve(process.cwd(), "../../infra/postgres/migrations");
    for (const migrationFile of (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort()) {
      if (migrationFile === "005_remove_legacy_pilot_state.sql") {
        await client.query(
          `INSERT INTO app_sessions (id, actor_type, actor_id, auth_method)
           VALUES ('00000000-0000-0000-0000-000000000501', 'client', '00000000-0000-0000-0000-000000000502', 'portal_otp_upgrade')`,
        );
        await client.query(
          `INSERT INTO ingestion_runs (
             id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched,
             parser_failures, unmatched_count, started_at, finished_at, reconciled_at
           ) VALUES (
             '00000000-0000-0000-0000-000000000503', 'source-ihc', 'ihc', 'reconciled', 1, 1, 1,
             0, 0, now(), now(), now()
           )`,
        );
      }
      await client.query(await readFile(resolve(migrationsDirectory, migrationFile), "utf8"));
    }
    const removedLegacyColumns = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND (table_name, column_name) IN (('portal_links', 'verified_at'), ('ingestion_runs', 'reconciled_at'))`,
      [schema],
    );
    assert.deepEqual(removedLegacyColumns.rows, []);
    const tightenedConstraints = await client.query<{ constraint_name: string; definition: string }>(
      `SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE connamespace = $1::regnamespace
         AND conname IN ('app_sessions_auth_method_check', 'ingestion_runs_status_check')
       ORDER BY conname`,
      [schema],
    );
    assert.equal(tightenedConstraints.rows.length, 2);
    assert.ok(tightenedConstraints.rows.every((row) => !/portal_otp_upgrade|reconciled/.test(row.definition)));
    assert.equal(
      Number((await client.query("SELECT COUNT(*) AS count FROM app_sessions WHERE id = '00000000-0000-0000-0000-000000000501'")).rows[0].count),
      0,
    );
    assert.equal(
      (await client.query("SELECT status FROM ingestion_runs WHERE id = '00000000-0000-0000-0000-000000000503'")).rows[0].status,
      "needs_review",
    );

    process.env.POSTGRES_OPTIONS = `-c search_path=${schema},public`;
    store = createPostgresProductStore(testDatabaseUrl);

    const first = await registerLawyer(store, "03007770001", "First Lawyer");
    const second = await registerLawyer(store, "03007770002", "Second Lawyer");
    assert.notEqual(first.firmId, second.firmId);

    const matter = await store.createMatter(first, {
      firmId: first.firmId!,
      courtId: "ihc",
      rawCaseNumber: "W.P. 11/2026",
      normalizedCaseNumber: "WRIT PETITION 11/2026",
      title: "First workspace matter",
      matterType: "litigation",
      stage: "new",
      status: "open",
      nextHearingAt: null,
      leadLawyerId: first.actorId,
    });
    assert.ok(matter);
    const trackedReference = await client.query(
      `SELECT cr.display_name, cr.automation_provider, tcr.raw_case_number, tcr.normalized_case_number
       FROM tracked_case_references tcr JOIN court_registry cr ON cr.id = tcr.court_id
       WHERE tcr.matter_id = $1`,
      [matter.id],
    );
    assert.deepEqual(trackedReference.rows[0], {
      display_name: "Islamabad High Court",
      automation_provider: "ihc",
      raw_case_number: "W.P. 11/2026",
      normalized_case_number: "WRIT PETITION 11/2026",
    });
    assert.ok(await store.updateMatter(first, matter.id, {
      rawCaseNumber: "W.P. 12/2026",
      normalizedCaseNumber: "WRIT PETITION 12/2026",
    }));
    const updatedReference = await client.query(
      "SELECT raw_case_number, normalized_case_number FROM tracked_case_references WHERE matter_id = $1",
      [matter.id],
    );
    assert.deepEqual(updatedReference.rows[0], {
      raw_case_number: "W.P. 12/2026",
      normalized_case_number: "WRIT PETITION 12/2026",
    });

    const conflictDate = "2030-01-20";
    assert.ok(await store.updateMatter(first, matter.id, { nextHearingAt: conflictDate }));
    const secondCalendarMatter = await store.createMatter(first, {
      firmId: first.firmId!,
      courtId: "ihc",
      rawCaseNumber: "W.P. 13/2026",
      normalizedCaseNumber: "WRIT PETITION 13/2026",
      title: "Calendar conflict matter",
      matterType: "litigation",
      stage: "new",
      status: "open",
      nextHearingAt: conflictDate,
      leadLawyerId: first.actorId,
    });
    assert.ok(secondCalendarMatter);
    let manualItems = (await store.listCalendar(first)).filter((item) => [matter.id, secondCalendarMatter.id].includes(item.matterId));
    assert.deepEqual(manualItems.map((item) => item.conflictState), ["none", "none"]);
    assert.ok(await store.updateMatter(first, secondCalendarMatter.id, { courtId: "rawalpindi-district" }));
    manualItems = (await store.listCalendar(first)).filter((item) => [matter.id, secondCalendarMatter.id].includes(item.matterId));
    assert.deepEqual(manualItems.map((item) => item.conflictState), ["possible", "possible"]);
    assert.ok(await store.updateMatter(first, secondCalendarMatter.id, { nextHearingAt: null }));
    manualItems = (await store.listCalendar(first)).filter((item) => [matter.id, secondCalendarMatter.id].includes(item.matterId));
    assert.deepEqual(manualItems.map((item) => item.conflictState), ["none"]);

    assert.equal(await store.getMatter(second, matter.id), null);
    assert.deepEqual(await store.listMatters(second), []);
    const party = await store.createMatterParty(first, matter.id, { partyType: "petitioner", displayName: "Pilot Petitioner", contactRef: null });
    assert.ok(party);
    assert.equal(await store.createMatterParty(second, matter.id, { partyType: "respondent", displayName: "Blocked", contactRef: null }), null);
    assert.equal((await store.updateMatterParty(first, matter.id, party.id, { displayName: "Updated Petitioner" }))?.displayName, "Updated Petitioner");
    assert.equal(await store.deleteMatterParty(second, matter.id, party.id), false);

    const clientAccount = await store.createClient(first, { phone: "03008880001", displayName: "Pilot Client", language: "en" });
    assert.ok(clientAccount);
    const duplicatePhoneClient = await store.createClient(second, { phone: clientAccount.phone, displayName: "Other Firm Client", language: "en" });
    assert.ok(duplicatePhoneClient);
    assert.notEqual(duplicatePhoneClient.id, clientAccount.id);
    assert.equal(await store.canRequestClientOtp(clientAccount.phone), false);
    assert.equal(await store.canRequestClientOtpForAccount(clientAccount.id, clientAccount.phone), true);
    assert.ok(await store.createOtpRequest({ actorType: "client", phone: clientAccount.phone, code: "135790" }));
    assert.equal(await store.verifyOtp("client", clientAccount.phone, "135790"), null);
    assert.ok(await store.createOtpRequest({ actorType: "client", phone: clientAccount.phone, code: "135791" }));
    assert.deepEqual(await store.verifyClientOtpForAccount(clientAccount.id, clientAccount.phone, "135791"), {
      actorType: "client",
      actorId: clientAccount.id,
      firmId: first.firmId,
    });
    assert.ok(await store.shareMatterWithClient(first, matter.id, clientAccount.id));
    const clientSession = { actorType: "client" as const, actorId: clientAccount.id, firmId: first.firmId };
    assert.ok(await store.updateNotificationPreference(clientSession, { emailEnabled: false, smsEnabled: true, optedOut: false }, "staff_recorded_client_consent"));
    const document = await store.createDocument(first, {
      firmId: first.firmId!,
      matterId: matter.id,
      type: "hearing_order",
      title: "pilot-order.pdf",
      storageKey: `test:${matter.id}`,
      mimeType: "application/pdf",
      uploadedBy: first.actorId,
      ocrStatus: "completed",
      ocrText: "Order recorded",
      searchText: "Order recorded",
      portalVisible: true,
    });
    assert.ok(document);
    const internalDocument = await store.createDocument(first, {
      firmId: first.firmId!,
      matterId: matter.id,
      type: "note",
      title: "internal-note.txt",
      storageKey: `test:internal:${matter.id}`,
      mimeType: "text/plain",
      uploadedBy: first.actorId,
      ocrStatus: "pending",
      ocrText: null,
      searchText: null,
      portalVisible: false,
    });
    assert.ok(internalDocument);
    assert.equal(await store.getDocument(clientSession, internalDocument.id), null);
    assert.ok(!(await store.listDocuments(clientSession)).some((entry) => entry.id === internalDocument.id));
    assert.equal(await store.getDocument(second, document.id), null);
    assert.equal(await store.createDocument(second, {
      firmId: second.firmId!,
      matterId: matter.id,
      type: "note",
      title: "blocked-cross-workspace.txt",
      storageKey: `test:blocked:${matter.id}`,
      mimeType: "text/plain",
      uploadedBy: second.actorId,
      ocrStatus: "pending",
      ocrText: null,
      searchText: null,
      portalVisible: false,
    }), null);

    const { agendaDate: tomorrow } = (await import("../src/lib/notification-schedule.js")).nextDayAgendaSchedule(new Date());
    const ingestion = await store.ingestIhcCauseList([
      {
        court: "Court No. 1",
        judgeNames: "Pilot Bench",
        caseNumber: "WRIT PETITION 12/2026",
        caseStage: "Hearing",
        parties: "A v B",
        advocates: "Pilot Lawyer",
      },
      {
        court: "Court No. 2",
        judgeNames: "Review Bench",
        caseNumber: "WRIT PETITION 999/2026",
        caseStage: "Hearing",
        parties: "C v D",
        advocates: "Unknown Lawyer",
      },
    ], tomorrow, "urgent");
    assert.equal(ingestion.matched, 1);
    assert.equal((await store.listCalendar(first)).length, 1);
    const unmatched = await store.listUnmatchedCauseEntries(first);
    assert.equal(unmatched.length, 1);
    assert.equal(await store.linkUnmatchedCauseEntry(second, String(unmatched[0].id), matter.id), null);
    assert.ok(await store.linkUnmatchedCauseEntry(first, String(unmatched[0].id), matter.id));
    assert.deepEqual(await store.listUnmatchedCauseEntries(first), []);

    assert.ok(await store.addHearing(first, {
      matterId: matter.id,
      listedAt: new Date().toISOString(),
      outcome: "Adjourned",
      notes: "Client update required",
      nextDate: tomorrow,
      courtroom: "Court No. 1",
      bench: "Pilot Bench",
      sourceType: "manual_staff",
      documentId: document.id,
    }));
    assert.ok(await store.schedulePilotNotifications(new Date()));
    const notificationJobs = await store.listNotificationJobs(first);
    assert.ok(notificationJobs.some((job) => job.templateKey === "post_hearing_update"));
    assert.ok(notificationJobs.some((job) => job.templateKey === "lawyer_next_day_agenda"));
    assert.ok(notificationJobs.some((job) => job.templateKey === "client_hearing_reminder"));
    const reminderJob = notificationJobs.find((job) => job.templateKey === "client_hearing_reminder")!;
    assert.equal(reminderJob.templateVersion, 1);
    assert.deepEqual(await store.getNotificationTemplate(reminderJob), {
      templateKey: "client_hearing_reminder",
      channel: "sms",
      version: 1,
      subjectTemplate: "",
      bodyTemplate: "Legal Bhai hearing reminder. Your hearing is scheduled in approximately 24 hours.\n{{payload}}",
      enabled: true,
    });
    assert.equal(await store.schedulePilotNotifications(new Date()), 0);

    const retryJob = reminderJob;
    await store.recordNotificationAttempt(retryJob.id, { providerId: null, error: "provider unavailable" });
    await store.recordNotificationAttempt(retryJob.id, { providerId: null, error: "provider unavailable" });
    await store.recordNotificationAttempt(retryJob.id, { providerId: null, error: "provider unavailable" });
    const failedJob = (await store.listNotificationJobs(first)).find((job) => job.id === retryJob.id)!;
    assert.equal(failedJob.status, "failed");
    assert.equal(failedJob.attemptCount, 3);

    const rescheduledDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    assert.ok(await store.addHearing(first, {
      matterId: matter.id,
      listedAt: new Date().toISOString(),
      outcome: "Adjourned",
      notes: "Hearing date changed",
      nextDate: rescheduledDate,
      courtroom: "Court No. 1",
      bench: "Pilot Bench",
      sourceType: "manual_staff",
      documentId: null,
    }));
    assert.ok(await store.schedulePilotNotifications(new Date()));
    const rescheduledReminder = (await store.listNotificationJobs(first))
      .find((job) => job.templateKey === "client_hearing_reminder" && String(job.payload.nextHearingAt).startsWith(rescheduledDate));
    assert.ok(rescheduledReminder);
    assert.equal(rescheduledReminder.status, "pending");

    const queuedClientUpdate = notificationJobs.find((job) => job.templateKey === "post_hearing_update")!;
    assert.deepEqual(await store.getNotificationRecipient(queuedClientUpdate), { phone: clientAccount.phone, email: null });
    assert.ok(await store.updateNotificationPreference(clientSession, { emailEnabled: false, smsEnabled: false, optedOut: true }));
    assert.equal(await store.getNotificationRecipient(queuedClientUpdate), null);
    const postHearingCount = (await store.listNotificationJobs(first)).filter((job) => job.templateKey === "post_hearing_update").length;
    assert.ok(await store.addHearing(first, {
      matterId: matter.id,
      listedAt: new Date().toISOString(),
      outcome: "Disposed",
      notes: "Opted-out client must not receive this update",
      nextDate: null,
      courtroom: "Court No. 1",
      bench: "Pilot Bench",
      sourceType: "manual_staff",
      documentId: null,
    }));
    assert.equal((await store.listNotificationJobs(first)).filter((job) => job.templateKey === "post_hearing_update").length, postHearingCount);

    const portal = await store.createPortalLink(first, matter.id);
    assert.ok(portal);
    assert.ok(await store.getPortalAccess(portal.rawToken));
    assert.deepEqual((await store.listPortalMattersForAccess(portal.rawToken, portal.portalLink.id)).map((entry) => entry.id), [matter.id]);
    assert.deepEqual((await store.getPortalMatterForAccess(portal.rawToken, portal.portalLink.id, matter.id))?.documents.map((entry) => entry.id), [document.id]);
    assert.equal(await store.unlinkMatterFromClient(second, matter.id, clientAccount.id), false);
    assert.equal(await store.unlinkMatterFromClient(first, matter.id, clientAccount.id), true);
    assert.equal(await store.getPortalAccess(portal.rawToken), null);
    assert.deepEqual(await store.listMatters(clientSession), []);
    assert.ok(await store.shareMatterWithClient(first, matter.id, clientAccount.id));
    assert.equal((await store.updateClient(first, clientAccount.id, { status: "archived" }))?.status, "archived");
    assert.equal(await store.getPortalAccess(portal.rawToken), null);
    assert.equal(await store.canRequestClientOtpForAccount(clientAccount.id, clientAccount.phone), false);
    assert.equal(await store.shareMatterWithClient(first, matter.id, clientAccount.id), null);

    process.env.JWT_SECRET = "postgres-integration-test-secret";
    app = Fastify();
    registerProductRoutes(app, store);

    const portalClient = await store.createClient(first, { phone: "03008880003", displayName: "Scoped Portal Client", language: "en" });
    assert.ok(portalClient);
    assert.ok(await store.shareMatterWithClient(first, matter.id, portalClient.id));
    const scopedPortal = await store.createPortalLink(first, matter.id, 24, portalClient.id);
    assert.ok(scopedPortal);
    const portalOtpRequest = await app.inject({ method: "POST", url: "/v1/portal/otp", payload: { token: scopedPortal.rawToken } });
    assert.equal(portalOtpRequest.statusCode, 200);
    const portalOtpVerify = await app.inject({
      method: "POST",
      url: "/v1/portal/otp/verify",
      payload: { token: scopedPortal.rawToken, code: (portalOtpRequest.json() as { devCode: string }).devCode },
    });
    assert.equal(portalOtpVerify.statusCode, 200);
    const portalAccessToken = (portalOtpVerify.json() as { token: string }).token;
    assert.equal((await app.inject({ method: "GET", url: `/v1/portal/cases?token=${scopedPortal.rawToken}` })).statusCode, 401);
    const scopedPortalCases = await app.inject({
      method: "GET",
      url: `/v1/portal/cases?token=${scopedPortal.rawToken}`,
      headers: { authorization: `Bearer ${portalAccessToken}` },
    });
    assert.deepEqual((scopedPortalCases.json() as { cases: Array<{ id: string }> }).cases.map((entry) => entry.id), [matter.id]);
    assert.equal((await app.inject({
      method: "GET",
      url: "/v1/clients/me/matters",
      headers: { authorization: `Bearer ${portalAccessToken}` },
    })).statusCode, 403);

    const requestOtp = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { actorType: "staff", phone: "03007770001" } });
    assert.equal(requestOtp.statusCode, 200);
    const verify = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { actorType: "staff", phone: "03007770001", code: "246810" } });
    assert.equal(verify.statusCode, 200);
    const verifiedAuth = verify.json() as { token: string; refreshToken: string };
    const token = verifiedAuth.token;
    const list = await app.inject({ method: "GET", url: "/v1/matters", headers: { authorization: `Bearer ${token}` } });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(
      (list.json() as { matters: Array<{ id: string }> }).matters.map((entry) => entry.id).sort(),
      [matter.id, secondCalendarMatter.id].sort(),
    );

    const concurrentRotations = await Promise.all([
      app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: verifiedAuth.refreshToken } }),
      app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: verifiedAuth.refreshToken } }),
    ]);
    assert.deepEqual(concurrentRotations.map((response) => response.statusCode).sort(), [200, 401]);

    assert.ok(await store.createPilotInvite({ phone: "03007770003" }));
    const registrationOtp = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { actorType: "staff", phone: "03007770003" },
    });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/staff/register",
      payload: {
        phone: "03007770003",
        code: (registrationOtp.json() as { devCode: string }).devCode,
        displayName: "Audited Lawyer",
        email: "audited@example.test",
        firmName: "Audited Lawyer Chambers",
        primaryCity: "Islamabad",
      },
    });
    assert.equal(registration.statusCode, 200);
    const auditResponse = await app.inject({
      method: "GET",
      url: "/v1/alerts",
      headers: { authorization: `Bearer ${(registration.json() as { token: string }).token}` },
    });
    const auditEventTypes = (auditResponse.json() as { auditEvents: Array<{ eventType: string }> }).auditEvents.map(
      (event) => event.eventType,
    );
    assert.ok(auditEventTypes.includes("workspace.registered"));
    assert.ok(auditEventTypes.includes("auth.session.created"));
  } finally {
    await app?.close();
    await store?.close();
    process.env.POSTGRES_OPTIONS = previousOptions;
    process.env.JWT_SECRET = previousJwtSecret;
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await admin.end();
  }
});

async function registerLawyer(
  store: ReturnType<typeof createPostgresProductStore>,
  phone: string,
  displayName: string,
) {
  assert.ok(await store.createPilotInvite({ phone }));
  assert.ok(await store.createOtpRequest({ actorType: "staff", phone, code: "246810" }));
  const session = await store.registerInvitedSoloLawyer({
    phone,
    code: "246810",
    displayName,
    email: `${phone}@example.test`,
    firmName: `${displayName} Chambers`,
    primaryCity: "Islamabad",
  });
  assert.ok(session);
  return session;
}
