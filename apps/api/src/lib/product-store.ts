import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  AuditEvent,
  CalendarItem,
  ClientAccount,
  ClientMembership,
  CourtSource,
  DocumentLink,
  Firm,
  FirmMembership,
  Hearing,
  IngestionRun,
  Invoice,
  Matter,
  MatterParty,
  Message,
  MessageThread,
  PortalLink,
  ProductAlert,
  ProductAuthMethod,
  ProductDocument,
  ProductLanguage,
  ProductSession,
  ProductUser,
  Session,
  TimeEntry,
} from "@wakeel/shared";
import { clientMethods } from "../store/sqlite/clients.js";
import { coreMethods } from "../store/sqlite/core.js";
import { hearingMethods } from "../store/sqlite/hearings.js";
import { matterMethods } from "../store/sqlite/matters.js";
import type {
  ActiveRefreshToken,
  CreateDocumentInput,
  MatterDetail,
  NotificationJobRecord,
  NotificationPreference,
  OtpRequestRecord,
  OverviewReport,
  PortalAccess,
  ProductProfile,
  SearchHit,
  StoredDocumentRow,
} from "../store/types.js";
import { decodeJson, encodeJson, hashValue, nowIso } from "../store/utils.js";
import { envFlag, isProduction } from "./config.js";
import {
  getCourtSourceDefinition,
  normalizeCourtCaseNumber,
  type CourtCauseListEntry,
  type CourtListType,
} from "./court-sources.js";
import type { IhcCauseListRow } from "./ihc.js";
import { syncToFiles } from "./file-sync.js";
import { nextDayAgendaSchedule, type NotificationTemplate } from "./notification-schedule.js";
import { normalizePakistanPhone } from "./validation.js";

type SqliteNotificationWhere =
  | "WHERE firm_id = ?"
  | "WHERE status IN ('pending', 'retrying') AND scheduled_at <= ? AND attempt_count < 3 ORDER BY scheduled_at LIMIT ?"
  | "WHERE id = ?";

const SQLITE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteSqliteIdentifier(identifier: string): string {
  if (!SQLITE_IDENTIFIER.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function assertSafeColumnDefinition(definition: string): void {
  if (!/^[A-Z0-9_ ()]+$/.test(definition)) {
    throw new Error("Unsafe SQLite column definition");
  }
}

export type {
  CsvImportPreview,
  MatterDetail,
  NotificationJobRecord,
  NotificationPreference,
  OtpRequestRecord,
  OverviewReport,
  ProductClientDetail,
  ProductClientSummary,
  ProductProfile,
  SearchHit,
} from "../store/types.js";

export class ProductStore {
  readonly db: DatabaseSync;

  constructor(dbPath: string, options: { seed?: boolean } = {}) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec("PRAGMA foreign_keys = ON;");

    this.db = new Proxy(rawDb, {
      get: (target, prop, receiver) => {
        if (prop === "prepare") {
          return (sql: string) => {
            const stmt = target.prepare(sql);
            const isMutation = /insert|update|delete|replace/i.test(sql);
            if (isMutation) {
              return new Proxy(stmt, {
                get: (stmtTarget, stmtProp) => {
                  if (stmtProp === "run") {
                    return (...args: any[]) => {
                      const res = (stmtTarget.run as any)(...args);
                      this.triggerSync();
                      return res;
                    };
                  }
                  const value = Reflect.get(stmtTarget, stmtProp);
                  return typeof value === "function" ? value.bind(stmtTarget) : value;
                }
              });
            }
            return stmt;
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as any;

    this.setup();
    
    // Check seed options
    const shouldSeed = options.seed ?? (process.env.NODE_ENV === "test" || process.env.WAKEEL_TESTING === "true" || envFlag("ENABLE_PRODUCT_SEED_DATA", false));
    if (shouldSeed) {
      this.seed();
    }

    this.triggerSync();
  }

  triggerSync(): void {
    try {
      syncToFiles(this.db);
    } catch (err: any) {
      console.error(`[FILE SYNC ERROR] ${err.message}`);
    }
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    assertSafeColumnDefinition(definition);
    const quotedTable = quoteSqliteIdentifier(table);
    const quotedColumn = quoteSqliteIdentifier(column);
    const rows = this.db.prepare(`PRAGMA table_info(${quotedTable})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === column)) {
      this.db.exec(`ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} ${definition}`);
    }
  }

  private setup(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS otp_requests (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        phone TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS firms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        primary_city TEXT NOT NULL,
        billing_plan TEXT NOT NULL,
        timezone TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS product_users (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        display_name TEXT NOT NULL,
        language TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS firm_memberships (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        office_label TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS client_accounts (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        display_name TEXT NOT NULL,
        language TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        firm_id TEXT,
        UNIQUE (firm_id, phone)
      );

      CREATE TABLE IF NOT EXISTS matters (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        court_id TEXT NOT NULL,
        raw_case_number TEXT NOT NULL,
        normalized_case_number TEXT NOT NULL,
        title TEXT NOT NULL,
        matter_type TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        next_hearing_at TEXT,
        lead_lawyer_id TEXT REFERENCES product_users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matter_parties (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        party_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        contact_ref TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS client_memberships (
        id TEXT PRIMARY KEY,
        client_account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        access_level TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS message_threads (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL UNIQUE REFERENCES matters(id) ON DELETE CASCADE,
        participant_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        body TEXT NOT NULL,
        language TEXT NOT NULL,
        delivery_channel TEXT NOT NULL,
        delivery_state TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        matter_id TEXT REFERENCES matters(id) ON DELETE SET NULL,
        folder_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        ocr_status TEXT NOT NULL,
        ocr_text TEXT,
        search_text TEXT,
        portal_visible INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_links (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hearings (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        listed_at TEXT NOT NULL,
        outcome TEXT NOT NULL,
        notes TEXT NOT NULL,
        next_date TEXT,
        courtroom TEXT,
        bench TEXT,
        source_type TEXT NOT NULL,
        document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calendar_items (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        listed_at TEXT NOT NULL,
        courtroom TEXT,
        bench TEXT,
        source_type TEXT NOT NULL,
        source_confidence REAL NOT NULL,
        conflict_state TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        minutes INTEGER NOT NULL,
        narrative TEXT NOT NULL,
        billable INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        client_account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        matter_id TEXT REFERENCES matters(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        issued_at TEXT,
        due_at TEXT,
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS court_sources (
        id TEXT PRIMARY KEY,
        court_id TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        ingestion_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        last_successful_sync_at TEXT,
        metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS magic_link_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_sessions (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        firm_id TEXT,
        auth_method TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS portal_links (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        client_account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        court_source_id TEXT NOT NULL REFERENCES court_sources(id) ON DELETE CASCADE,
        court_id TEXT NOT NULL,
        status TEXT NOT NULL,
        rows_fetched INTEGER NOT NULL,
        rows_parsed INTEGER NOT NULL,
        rows_matched INTEGER NOT NULL,
        parser_failures INTEGER NOT NULL,
        unmatched_count INTEGER NOT NULL,
        note TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pilot_invites (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        email TEXT,
        status TEXT NOT NULL,
        invited_at TEXT NOT NULL,
        accepted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS cause_list_entries (
        id TEXT PRIMARY KEY,
        court_source_id TEXT NOT NULL REFERENCES court_sources(id) ON DELETE CASCADE,
        court_id TEXT,
        list_date TEXT NOT NULL,
        list_type TEXT NOT NULL,
        normalized_case_number TEXT NOT NULL,
        raw_case_number TEXT NOT NULL,
        courtroom TEXT,
        bench TEXT,
        source_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matter_matches (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        cause_list_entry_id TEXT NOT NULL REFERENCES cause_list_entries(id) ON DELETE CASCADE,
        confidence REAL NOT NULL,
        state TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(matter_id, cause_list_entry_id)
      );

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        email_enabled INTEGER NOT NULL,
        sms_enabled INTEGER NOT NULL,
        opted_out_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(firm_id, actor_type, actor_id)
      );

      CREATE TABLE IF NOT EXISTS notification_templates (
        template_key TEXT NOT NULL,
        channel TEXT NOT NULL,
        version INTEGER NOT NULL,
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        PRIMARY KEY(template_key, channel, version)
      );

      CREATE TABLE IF NOT EXISTS notification_consents (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        granted_at TEXT,
        revoked_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(firm_id, actor_type, actor_id, channel)
      );

      CREATE TABLE IF NOT EXISTS notification_jobs (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        template_key TEXT NOT NULL,
        template_version INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_attempts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
        provider_id TEXT,
        status TEXT NOT NULL,
        error TEXT,
        attempted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS csv_import_jobs (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL,
        status TEXT NOT NULL,
        total_rows INTEGER NOT NULL,
        accepted_rows INTEGER NOT NULL,
        rejected_rows INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS csv_import_rows (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES csv_import_jobs(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        normalized_case_number TEXT,
        state TEXT NOT NULL,
        error TEXT,
        matter_id TEXT REFERENCES matters(id) ON DELETE SET NULL
      );
    `);

    this.ensureColumn("product_users", "email", "TEXT");
    this.ensureColumn("documents", "portal_visible", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("otp_requests", "attempt_count", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("client_accounts", "firm_id", "TEXT");
    this.ensureColumn("cause_list_entries", "court_id", "TEXT");
    this.ensureColumn("notification_jobs", "template_version", "INTEGER NOT NULL DEFAULT 1");
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_product_users_email ON product_users(email) WHERE email IS NOT NULL;");
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_client_memberships_unique ON client_memberships(client_account_id, matter_id);");
    const createdAt = nowIso();
    const insertTemplate = this.db.prepare(`
      INSERT OR IGNORE INTO notification_templates (
        template_key, channel, version, subject_template, body_template, enabled, created_at
      ) VALUES (?, ?, 1, ?, ?, 1, ?)
    `);
    for (const template of [
      ["lawyer_next_day_agenda", "email", "Legal Bhai: tomorrow's court agenda", "Your next-day agenda:\n{{payload}}"],
      ["lawyer_next_day_agenda", "sms", "", "Legal Bhai next-day agenda:\n{{payload}}"],
      ["client_hearing_reminder", "sms", "", "Legal Bhai hearing reminder. Your hearing is scheduled in approximately 24 hours.\n{{payload}}"],
      ["post_hearing_update", "sms", "", "Legal Bhai matter update. Your lawyer posted a hearing update.\n{{payload}}"],
      ["portal_access_token", "sms", "", "Legal Bhai client portal access:\n{{payload}}"],
    ] as const) {
      insertTemplate.run(...template, createdAt);
    }
  }

  private resetSeedData(): void {
    const tables = [
      "notification_jobs",
      "notification_attempts",
      "notification_preferences",
      "notification_consents",
      "portal_links",
      "refresh_tokens",
      "app_sessions",
      "magic_link_tokens",
      "audit_events",
      "invoices",
      "time_entries",
      "calendar_items",
      "hearings",
      "document_links",
      "documents",
      "messages",
      "message_threads",
      "client_memberships",
      "matter_parties",
      "matter_matches",
      "cause_list_entries",
      "ingestion_runs",
      "court_sources",
      "csv_import_jobs",
      "csv_import_rows",
      "alerts",
      "matters",
      "client_accounts",
      "firm_memberships",
      "product_users",
      "firms",
      "otp_requests",
      "pilot_invites",
    ];

    this.db.exec("PRAGMA foreign_keys = OFF;");
    try {
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table}`).run();
      }
    } finally {
      this.db.exec("PRAGMA foreign_keys = ON;");
    }
  }

  private seed(): void {
    this.resetSeedData();

    const createdAt = nowIso();
    const firmId = "firm-hassan-co";
    this.db
      .prepare(
        "INSERT INTO firms (id, name, primary_city, billing_plan, timezone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(firmId, "Hassan & Co. Law Associates", "Islamabad", "solo_plus", "Asia/Karachi", "trial", createdAt);

    const staffUsers: ProductUser[] = [
      { id: "staff-owner", phone: "03001234567", email: "ahmed@hassanco.pk", displayName: "Advocate Salman Hassan", language: "en", status: "active" },
      { id: "staff-lawyer", phone: "03007654321", email: "sana@hassanco.pk", displayName: "Sana Malik", language: "en", status: "active" },
      { id: "staff-assistant", phone: "03001112222", email: "hamza@hassanco.pk", displayName: "Hamza Sheikh", language: "en", status: "active" },
    ];
    const insertUser = this.db.prepare(
      "INSERT INTO product_users (id, phone, email, display_name, language, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const user of staffUsers) {
      insertUser.run(user.id, user.phone, user.email, user.displayName, user.language, user.status, createdAt);
    }

    const memberships: Array<FirmMembership> = [
      { id: "membership-owner", firmId, userId: "staff-owner", role: "owner", permissions: ["*"], officeLabel: "Islamabad HQ" },
      { id: "membership-lawyer", firmId, userId: "staff-lawyer", role: "lawyer", permissions: ["matters.read", "matters.write", "hearings.write", "documents.read", "documents.write", "time.write", "court.sync"], officeLabel: "Islamabad HQ" },
      { id: "membership-assistant", firmId, userId: "staff-assistant", role: "assistant", permissions: ["matters.read", "documents.read"], officeLabel: "Rawalpindi Desk" },
    ];
    const insertMembership = this.db.prepare(
      "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions_json, office_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const membership of memberships) {
      insertMembership.run(
        membership.id,
        membership.firmId,
        membership.userId,
        membership.role,
        encodeJson(membership.permissions),
        membership.officeLabel,
        createdAt,
      );
    }

    const clients: ClientAccount[] = [
      { id: "client-redtone", phone: "03005550001", displayName: "Ahmed Zubair", language: "en", status: "active" },
    ];
    const insertClient = this.db.prepare(
      "INSERT INTO client_accounts (id, phone, display_name, language, status, created_at, firm_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const client of clients) {
      insertClient.run(client.id, client.phone, client.displayName, client.language, client.status, createdAt, firmId);
    }

    const matters: Matter[] = [
      {
        id: "matter-redtone",
        firmId,
        courtId: "ihc",
        rawCaseNumber: "W.P. 2076/2019",
        normalizedCaseNumber: "WRIT PETITION 2076/2019",
        title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc",
        matterType: "litigation",
        stage: "arguments",
        status: "open",
        nextHearingAt: "2026-08-18T11:00:00+05:00",
        leadLawyerId: "staff-owner",
      },
      {
        id: "matter-farooq",
        firmId,
        courtId: "rwp-district-sessions",
        rawCaseNumber: "Civil Suit 45/2025",
        normalizedCaseNumber: "CIVIL SUIT 45/2025",
        title: "Ahmed Zubair v. Property Builders Ltd",
        matterType: "litigation",
        stage: "evidence",
        status: "open",
        nextHearingAt: "2026-08-24T14:00:00+05:00",
        leadLawyerId: "staff-owner",
      },
    ];
    const insertMatter = this.db.prepare(`
      INSERT INTO matters (
        id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const matter of matters) {
      insertMatter.run(
        matter.id,
        matter.firmId,
        matter.courtId,
        matter.rawCaseNumber,
        matter.normalizedCaseNumber,
        matter.title,
        matter.matterType,
        matter.stage,
        matter.status,
        matter.nextHearingAt,
        matter.leadLawyerId,
        createdAt,
        createdAt,
      );
    }

    const parties: MatterParty[] = [
      { id: "party-redtone-a", matterId: "matter-redtone", partyType: "petitioner", displayName: "Redtone Telecommunications Pak Pvt Ltd", contactRef: "client-redtone" },
      { id: "party-redtone-b", matterId: "matter-redtone", partyType: "respondent", displayName: "Commissioner Inland Revenue", contactRef: null },
      { id: "party-zubair-property-a", matterId: "matter-farooq", partyType: "plaintiff" as any, displayName: "Ahmed Zubair", contactRef: "client-redtone" },
      { id: "party-zubair-property-b", matterId: "matter-farooq", partyType: "defendant" as any, displayName: "Property Builders Ltd", contactRef: null },
    ];
    const insertParty = this.db.prepare(
      "INSERT INTO matter_parties (id, matter_id, party_type, display_name, contact_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const party of parties) {
      insertParty.run(party.id, party.matterId, party.partyType, party.displayName, party.contactRef, createdAt);
    }

    const clientMemberships: ClientMembership[] = [
      { id: "client-membership-redtone", clientAccountId: "client-redtone", matterId: "matter-redtone", accessLevel: "message" },
      { id: "client-membership-zubair-property", clientAccountId: "client-redtone", matterId: "matter-farooq", accessLevel: "message" },
    ];
    const insertClientMembership = this.db.prepare(
      "INSERT INTO client_memberships (id, client_account_id, matter_id, access_level, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const membership of clientMemberships) {
      insertClientMembership.run(
        membership.id,
        membership.clientAccountId,
        membership.matterId,
        membership.accessLevel,
        createdAt,
      );
    }

    const threads: MessageThread[] = [
      { id: "thread-redtone", matterId: "matter-redtone", participantType: "firm_client", status: "open" },
      { id: "thread-zubair-property", matterId: "matter-farooq", participantType: "firm_client", status: "open" },
    ];
    const insertThread = this.db.prepare(
      "INSERT INTO message_threads (id, matter_id, participant_type, status, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const thread of threads) {
      insertThread.run(thread.id, thread.matterId, thread.participantType, thread.status, createdAt);
    }

    const documents: ProductDocument[] = [
      {
        id: "doc-redtone-vakalatnama",
        firmId,
        matterId: "matter-redtone",
        folderId: null,
        type: "Agreement / Contract",
        title: "Vakalatnama_Signed.pdf",
        storageKey: "seed:vakalatnama-signed.pdf",
        mimeType: "application/pdf",
        uploadedBy: "staff-owner",
        ocrStatus: "completed",
        ocrText: "Signed vakalatnama authorizing Advocate Salman Hassan to appear before Islamabad High Court.",
        searchText: "Signed vakalatnama Redtone Telecommunications Advocate Salman Hassan Islamabad High Court.",
        portalVisible: true,
      },
      {
        id: "doc-redtone-written-objections",
        firmId,
        matterId: "matter-redtone",
        folderId: null,
        type: "General",
        title: "Written_Objections_Final.docx",
        storageKey: "seed:written-objections-final.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadedBy: "staff-owner",
        ocrStatus: "completed",
        ocrText: "Final written objections with jurisdictional grounds, facts, legal arguments, and prayer clauses.",
        searchText: "Final written objections jurisdictional grounds Redtone Telecommunications tax recovery Islamabad High Court.",
        portalVisible: true,
      },
      {
        id: "doc-redtone-order",
        firmId,
        matterId: "matter-redtone",
        folderId: null,
        type: "Evidence",
        title: "Evidence_Annexures.pdf",
        storageKey: "seed:evidence-annexures.pdf",
        mimeType: "application/pdf",
        uploadedBy: "staff-owner",
        ocrStatus: "completed",
        ocrText: "Evidence annexures with payment receipts, department correspondence, and tax recovery notices.",
        searchText: "Evidence annexures payment receipts correspondence tax recovery notices Redtone.",
        portalVisible: true,
      },
      {
        id: "doc-redtone-hearing-order",
        firmId,
        matterId: "matter-redtone",
        folderId: null,
        type: "Court Notice",
        title: "Hearing_Order_April.png",
        storageKey: "seed:hearing-order-april.png",
        mimeType: "image/png",
        uploadedBy: "staff-owner",
        ocrStatus: "completed",
        ocrText: "Islamabad High Court order sheet showing arguments heard and order reserved for pronouncement.",
        searchText: "Islamabad High Court order sheet arguments heard order reserved pronouncement.",
        portalVisible: true,
      },
      {
        id: "doc-farooq-pleading",
        firmId,
        matterId: "matter-farooq",
        folderId: null,
        type: "General",
        title: "Plaint_Property_Dispute.pdf",
        storageKey: "seed:plaint-property-dispute.pdf",
        mimeType: "application/pdf",
        uploadedBy: "staff-owner",
        ocrStatus: "completed",
        ocrText: "Plaint seeking declaration, specific performance, and damages against Property Builders Ltd.",
        searchText: "Plaint Ahmed Zubair Property Builders Ltd declaration specific performance damages.",
        portalVisible: true,
      },
    ];
    for (const document of documents) {
      this.insertDocument(document);
    }

    const insertDocumentLink = this.db.prepare(
      "INSERT INTO document_links (id, document_id, matter_id, created_at) VALUES (?, ?, ?, ?)",
    );
    for (const document of documents) {
      if (document.matterId) {
        insertDocumentLink.run(`document-link-${document.id}`, document.id, document.matterId, createdAt);
      }
    }

    const hearings: Hearing[] = [
      {
        id: "hearing-redtone-1",
        matterId: "matter-redtone",
        listedAt: "2026-08-18T11:00:00+05:00",
        outcome: "Order pronouncement fixed",
        notes: "Bench heard both sides and fixed the matter for order pronouncement.",
        nextDate: "2026-08-18",
        courtroom: "Court No: 8",
        bench: "Justice Muhammad Azam Khan / Justice Inaam Ameen Minhas",
        sourceType: "live_ihc",
        documentId: null,
      },
      {
        id: "hearing-zubair-property-1",
        matterId: "matter-farooq",
        listedAt: "2026-08-24T14:00:00+05:00",
        outcome: "Evidence fixed",
        notes: "Plaintiff witnesses to appear with original allotment documents and payment receipts.",
        nextDate: "2026-08-24",
        courtroom: "Civil Court Room 6",
        bench: "Civil Judge Rawalpindi",
        sourceType: "live_rwp_district",
        documentId: null,
      },
    ];
    const insertHearing = this.db.prepare(`
      INSERT INTO hearings (id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const hearing of hearings) {
      insertHearing.run(
        hearing.id,
        hearing.matterId,
        hearing.listedAt,
        hearing.outcome,
        hearing.notes,
        hearing.nextDate,
        hearing.courtroom,
        hearing.bench,
        hearing.sourceType,
        hearing.documentId,
        createdAt,
      );
    }

    const calendarItems: CalendarItem[] = [
      { id: "calendar-redtone", matterId: "matter-redtone", listedAt: "2026-08-18T11:00:00+05:00", courtroom: "Court No: 8", bench: "Bench A", sourceType: "live_ihc", sourceConfidence: 0.96, conflictState: "none" },
      { id: "calendar-zubair-property", matterId: "matter-farooq", listedAt: "2026-08-24T14:00:00+05:00", courtroom: "Civil Court Room 6", bench: "Civil Judge Rawalpindi", sourceType: "live_rwp_district", sourceConfidence: 0.9, conflictState: "none" },
    ];
    const insertCalendar = this.db.prepare(
      "INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const item of calendarItems) {
      insertCalendar.run(
        item.id,
        item.matterId,
        item.listedAt,
        item.courtroom,
        item.bench,
        item.sourceType,
        item.sourceConfidence,
        item.conflictState,
        createdAt,
      );
    }

    const messages: Message[] = [
      {
        id: "message-redtone-1",
        threadId: "thread-redtone",
        senderType: "staff",
        senderId: "staff-owner",
        body: "Arguments concluded today before the Islamabad High Court. The bench has fixed the matter for order pronouncement.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-14T11:42:00+05:00",
      },
      {
        id: "message-redtone-2",
        threadId: "thread-redtone",
        senderType: "client",
        senderId: "client-redtone",
        body: "Thank you, Salman sahib. Does the company need to prepare anything before the order is announced?",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-14T12:05:00+05:00",
      },
      {
        id: "message-redtone-3",
        threadId: "thread-redtone",
        senderType: "staff",
        senderId: "staff-owner",
        body: "No fresh filing is required right now. I have uploaded the written reply and both payment receipts in the portal for your records.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-14T12:22:00+05:00",
      },
      {
        id: "message-redtone-4",
        threadId: "thread-redtone",
        senderType: "client",
        senderId: "client-redtone",
        body: "Documents are visible. Please notify me as soon as the order is pronounced so we can brief management.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-14T12:40:00+05:00",
      },
      {
        id: "message-redtone-5",
        threadId: "thread-redtone",
        senderType: "staff",
        senderId: "staff-owner",
        body: "Of course. I will attend the pronouncement and send you the order summary immediately after court.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-14T12:55:00+05:00",
      },
      {
        id: "message-zubair-property-1",
        threadId: "thread-zubair-property",
        senderType: "staff",
        senderId: "staff-owner",
        body: "For the evidence hearing, please keep the original allotment letter, payment receipts, and CNIC copy ready.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-18T16:15:00+05:00",
      },
      {
        id: "message-zubair-property-2",
        threadId: "thread-zubair-property",
        senderType: "client",
        senderId: "client-redtone",
        body: "I have arranged the originals and will bring them to your office one day before the hearing.",
        language: "en",
        deliveryChannel: "in_app",
        deliveryState: "delivered",
        createdAt: "2026-05-18T16:31:00+05:00",
      },
    ];
    const insertMessage = this.db.prepare(
      "INSERT INTO messages (id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const message of messages) {
      insertMessage.run(
        message.id,
        message.threadId,
        message.senderType,
        message.senderId,
        message.body,
        message.language,
        message.deliveryChannel,
        message.deliveryState,
        message.createdAt,
      );
    }

    const timeEntries: TimeEntry[] = [
      { id: "time-redtone", firmId, matterId: "matter-redtone", userId: "staff-owner", startedAt: "2026-05-14T12:30:00+05:00", minutes: 95, narrative: "High Court appearance, order-pronouncement note, and client update", billable: true },
      { id: "time-zubair-property", firmId, matterId: "matter-farooq", userId: "staff-owner", startedAt: "2026-05-18T15:30:00+05:00", minutes: 45, narrative: "Witness preparation call and evidence checklist", billable: true },
    ];
    const insertTime = this.db.prepare(
      "INSERT INTO time_entries (id, firm_id, matter_id, user_id, started_at, minutes, narrative, billable, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const entry of timeEntries) {
      insertTime.run(
        entry.id,
        entry.firmId,
        entry.matterId,
        entry.userId,
        entry.startedAt,
        entry.minutes,
        entry.narrative,
        entry.billable ? 1 : 0,
        createdAt,
      );
    }

    const invoices: Invoice[] = [
      { id: "invoice-redtone", firmId, clientAccountId: "client-redtone", matterId: "matter-redtone", status: "issued", issuedAt: "2026-05-15", dueAt: "2026-05-30", total: 85000 },
    ];
    const insertInvoice = this.db.prepare(
      "INSERT INTO invoices (id, firm_id, client_account_id, matter_id, status, issued_at, due_at, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const invoice of invoices) {
      insertInvoice.run(
        invoice.id,
        invoice.firmId,
        invoice.clientAccountId,
        invoice.matterId,
        invoice.status,
        invoice.issuedAt,
        invoice.dueAt,
        invoice.total,
        createdAt,
      );
    }

    const sources: Array<CourtSource & { metrics: Record<string, number> }> = [
      { id: "source-ihc", courtId: "ihc", sourceType: "high_court", ingestionMode: "automation", status: "live", lastSuccessfulSyncAt: "2026-04-21T04:12:00Z", metrics: { fetched: 220, matched: 14, parserErrors: 0 } },
      { id: "source-lhc-rwp", courtId: "lhc-rawalpindi-bench", sourceType: "high_court", ingestionMode: "automation", status: "manual_review", lastSuccessfulSyncAt: null, metrics: { fetched: 0, matched: 0, parserErrors: 0 } },
      { id: "source-rwp-district", courtId: "rwp-district-sessions", sourceType: "district", ingestionMode: "automation", status: "live", lastSuccessfulSyncAt: "2026-05-18T03:25:00Z", metrics: { fetched: 74, matched: 5, parserErrors: 0 } },
    ];
    const insertSource = this.db.prepare(
      "INSERT INTO court_sources (id, court_id, source_type, ingestion_mode, status, last_successful_sync_at, metrics_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const source of sources) {
      insertSource.run(
        source.id,
        source.courtId,
        source.sourceType,
        source.ingestionMode,
        source.status,
        source.lastSuccessfulSyncAt,
        encodeJson(source.metrics),
        createdAt,
      );
    }

    const runs: IngestionRun[] = [
      {
        id: "run-ihc-latest",
        courtSourceId: "source-ihc",
        courtId: "ihc",
        status: "completed",
        rowsFetched: 220,
        rowsParsed: 220,
        rowsMatched: 14,
        parserFailures: 0,
        unmatchedCount: 3,
        note: null,
        startedAt: "2026-04-21T04:10:00Z",
        finishedAt: "2026-04-21T04:12:00Z",
      },
      {
        id: "run-lhc-rwp-latest",
        courtSourceId: "source-lhc-rwp",
        courtId: "lhc-rawalpindi-bench",
        status: "needs_review",
        rowsFetched: 0,
        rowsParsed: 0,
        rowsMatched: 0,
        parserFailures: 0,
        unmatchedCount: 0,
        note: null,
        startedAt: "2026-04-21T03:45:00Z",
        finishedAt: "2026-04-21T03:48:00Z",
      },
      {
        id: "run-rwp-latest",
        courtSourceId: "source-rwp-district",
        courtId: "rwp-district-sessions",
        status: "needs_review",
        rowsFetched: 74,
        rowsParsed: 72,
        rowsMatched: 5,
        parserFailures: 2,
        unmatchedCount: 6,
        note: null,
        startedAt: "2026-05-18T03:22:00Z",
        finishedAt: "2026-05-18T03:25:00Z",
      },
    ];
    const insertRun = this.db.prepare(
      `INSERT INTO ingestion_runs (
        id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures, unmatched_count, note, started_at, finished_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const run of runs) {
      insertRun.run(
        run.id,
        run.courtSourceId,
        run.courtId,
        run.status,
        run.rowsFetched,
        run.rowsParsed,
        run.rowsMatched,
        run.parserFailures,
        run.unmatchedCount,
        run.note,
        run.startedAt,
        run.finishedAt,
        createdAt,
      );
    }

    const alerts: ProductAlert[] = [
      { id: "alert-redtone", firmId, type: "hearing_due" as any, title: "Order pronouncement approaching", body: "W.P. 2076/2019 is fixed for order pronouncement at IHC.", createdAt, readAt: null },
      { id: "alert-message", firmId, type: "client_message", title: "New client reply from Ahmed Zubair", body: "Client confirmed witness documents for the property suit.", createdAt, readAt: null },
    ];
    const insertAlert = this.db.prepare(
      "INSERT INTO alerts (id, firm_id, type, title, body, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const alert of alerts) {
      insertAlert.run(alert.id, alert.firmId, alert.type, alert.title, alert.body, alert.createdAt, alert.readAt);
    }

    const insertPreference = this.db.prepare(`
      INSERT INTO notification_preferences (
        id, firm_id, actor_type, actor_id, email_enabled, sms_enabled, opted_out_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
    `);
    const insertConsent = this.db.prepare(`
      INSERT INTO notification_consents (
        id, firm_id, actor_type, actor_id, channel, status, source, granted_at, revoked_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'granted', 'demo_seed', ?, NULL, ?)
    `);
    for (const staff of staffUsers) {
      insertPreference.run(randomUUID(), firmId, "staff", staff.id, staff.email ? 1 : 0, 1, createdAt);
      insertConsent.run(randomUUID(), firmId, "staff", staff.id, "sms", createdAt, createdAt);
      if (staff.email) {
        insertConsent.run(randomUUID(), firmId, "staff", staff.id, "email", createdAt, createdAt);
      }
    }
    for (const client of clients) {
      insertPreference.run(randomUUID(), firmId, "client", client.id, 0, 1, createdAt);
      insertConsent.run(randomUUID(), firmId, "client", client.id, "sms", createdAt, createdAt);
    }

    this.createAuditEvent({
      firmId,
      actorType: "system",
      actorId: null,
      objectType: "firm",
      objectId: firmId,
      eventType: "seeded",
      payload: { matters: matters.length, clients: clients.length },
    });
  }

  close(): void {
    this.db.close();
  }

  healthCheck(): boolean {
    const row = this.db.prepare("SELECT 1 AS ok").get() as { ok: number };
    return row.ok === 1;
  }

  private insertDocument(document: ProductDocument): void {
    this.db
      .prepare(`
        INSERT INTO documents (
          id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        document.id,
        document.firmId,
        document.matterId,
        document.folderId,
        document.type,
        document.title,
        document.storageKey,
        document.mimeType,
        document.uploadedBy,
        document.ocrStatus,
        document.ocrText,
        document.searchText,
        document.portalVisible ? 1 : 0,
        nowIso(),
      );
  }

  createOtpRequest(input: OtpRequestRecord): { expiresAt: string; devCode: string | null } | null {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone) {
      return null;
    }
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recent = this.db
      .prepare("SELECT COUNT(*) AS count FROM otp_requests WHERE actor_type = ? AND phone = ? AND created_at >= ?")
      .get(input.actorType, phone, windowStart) as { count: number };
    const limit = process.env.NODE_ENV === "production" ? 5 : 100;
    if (recent.count >= limit) {
      return null;
    }
    const code = input.code;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO otp_requests (id, actor_type, phone, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), input.actorType, phone, hashValue(code), expiresAt, nowIso());

    return {
      expiresAt,
      devCode: process.env.NODE_ENV === "production" ? null : code,
    };
  }

  verifyOtp(
    actorType: "staff" | "client",
    phone: string,
    code: string,
  ): ProductSession | null {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }

    if (actorType === "staff") {
      if (!this.consumeOtpRequest(actorType, normalizedPhone, code)) {
        return null;
      }
      const staff = this.findStaffByPhone(normalizedPhone);
      if (!staff) {
        return null;
      }
      return {
        actorType: "staff",
        actorId: staff.user.id,
        firmId: staff.membership.firmId,
      };
    }

    const client = this.findUniqueClientByPhone(normalizedPhone);
    if (!client || client.status !== "active" || !this.consumeOtpRequest(actorType, normalizedPhone, code)) {
      return null;
    }

    return {
      actorType: "client",
      actorId: client.id,
      firmId: this.resolveClientFirmId(client.id, client.firmId),
    };
  }

  canRequestClientOtpForAccount(clientAccountId: string, phone: string): boolean {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return false;
    }
    const client = this.db
      .prepare("SELECT id FROM client_accounts WHERE id = ? AND phone = ? AND status = 'active'")
      .get(clientAccountId, normalizedPhone) as { id: string } | undefined;
    return Boolean(client);
  }

  verifyClientOtpForAccount(clientAccountId: string, phone: string, code: string): ProductSession | null {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }
    const client = this.db
      .prepare(`
        SELECT id, phone, display_name AS displayName, language, status, firm_id AS firmId
        FROM client_accounts
        WHERE id = ? AND phone = ? AND status = 'active'
      `)
      .get(clientAccountId, normalizedPhone) as (ClientAccount & { firmId: string | null }) | undefined;
    if (!client || !this.consumeOtpRequest("client", normalizedPhone, code)) {
      return null;
    }
    return {
      actorType: "client",
      actorId: client.id,
      firmId: this.resolveClientFirmId(client.id, client.firmId),
    };
  }

  private consumeOtpRequest(actorType: "staff" | "client", phone: string, code: string): boolean {
    const row = this.db
      .prepare(`
        SELECT id, code_hash AS codeHash
        FROM otp_requests
        WHERE actor_type = ? AND phone = ? AND used_at IS NULL AND expires_at >= ? AND attempt_count < 5
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(actorType, phone, nowIso()) as { id: string; codeHash: string } | undefined;
    if (!row) {
      return false;
    }
    if (row.codeHash !== hashValue(code)) {
      this.db.prepare("UPDATE otp_requests SET attempt_count = attempt_count + 1 WHERE id = ?").run(row.id);
      return false;
    }
    this.db.prepare("UPDATE otp_requests SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
    return true;
  }

  private consumePendingOtpRequest(actorType: "staff" | "client", phone: string): boolean {
    const row = this.db
      .prepare(`
        SELECT id
        FROM otp_requests
        WHERE actor_type = ? AND phone = ? AND used_at IS NULL AND expires_at >= ? AND attempt_count < 5
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(actorType, phone, nowIso()) as { id: string } | undefined;
    if (!row) {
      return false;
    }
    this.db.prepare("UPDATE otp_requests SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
    return true;
  }

  completeOtpAfterExternalVerify(actorType: "staff" | "client", phone: string): ProductSession | null {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }
    if (actorType === "staff") {
      if (!this.consumePendingOtpRequest(actorType, normalizedPhone)) {
        return null;
      }
      const staff = this.findStaffByPhone(normalizedPhone);
      if (!staff) {
        return null;
      }
      return {
        actorType: "staff",
        actorId: staff.user.id,
        firmId: staff.membership.firmId,
      };
    }
    const client = this.findUniqueClientByPhone(normalizedPhone);
    if (!client || client.status !== "active" || !this.consumePendingOtpRequest(actorType, normalizedPhone)) {
      return null;
    }
    return {
      actorType: "client",
      actorId: client.id,
      firmId: this.resolveClientFirmId(client.id, client.firmId),
    };
  }

  completeOtpAfterExternalVerifyForAccount(clientAccountId: string, phone: string): ProductSession | null {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }
    const client = this.db
      .prepare(`
        SELECT id, phone, display_name AS displayName, language, status, firm_id AS firmId
        FROM client_accounts
        WHERE id = ? AND phone = ? AND status = 'active'
      `)
      .get(clientAccountId, normalizedPhone) as (ClientAccount & { firmId: string | null }) | undefined;
    if (!client || !this.consumePendingOtpRequest("client", normalizedPhone)) {
      return null;
    }
    return {
      actorType: "client",
      actorId: client.id,
      firmId: this.resolveClientFirmId(client.id, client.firmId),
    };
  }

  canRequestStaffOtp(phone: string): boolean {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return false;
    }
    if (this.findStaffByPhone(normalizedPhone)) {
      return true;
    }

    if (this.canRequestClientOtp(normalizedPhone)) {
      return false;
    }

    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.WAKEEL_TESTING === "true" ||
      process.env.DEMO_DB_PATH?.includes("wakeel-product-api-") ||
      process.env.WAKEEL_PRODUCT_DB_PATH?.includes("wakeel-product-api-");

    if (process.env.NODE_ENV !== "production" && !isTestEnv) {
      const inviteExists = this.db
        .prepare("SELECT 1 FROM pilot_invites WHERE phone = ?")
        .get(normalizedPhone);
      if (!inviteExists) {
        this.createPilotInvite({ phone: normalizedPhone });
      }
      return true;
    }

    const invite = this.db
      .prepare("SELECT id FROM pilot_invites WHERE phone = ? AND status = ?")
      .get(normalizedPhone, "invited") as { id: string } | undefined;
    return Boolean(invite);
  }

  canRequestClientOtp(phone: string): boolean {
    const normalizedPhone = normalizePakistanPhone(phone);
    const client = normalizedPhone ? this.findUniqueClientByPhone(normalizedPhone) : null;
    return client?.status === "active";
  }

  createPilotInvite(input: { phone: string; email?: string | null }): { id: string; phone: string; email: string | null } | null {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone) {
      return null;
    }
    const invite = { id: randomUUID(), phone, email: input.email ?? null };
    this.db
      .prepare(`
        INSERT INTO pilot_invites (id, phone, email, status, invited_at, accepted_at)
        VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(phone) DO UPDATE SET email = excluded.email, status = excluded.status, invited_at = excluded.invited_at, accepted_at = NULL
      `)
      .run(invite.id, invite.phone, invite.email, "invited", nowIso());
    return invite;
  }

  registerInvitedSoloLawyer(input: {
    phone: string;
    code: string;
    displayName: string;
    email: string | null;
    firmName: string;
    primaryCity: string;
  }): ProductSession | null {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone || !this.canRequestStaffOtp(phone) || !this.consumeOtpRequest("staff", phone, input.code)) {
      return null;
    }
    const existing = this.findStaffByPhone(phone);
    if (existing) {
      return { actorType: "staff", actorId: existing.user.id, firmId: existing.membership.firmId };
    }

    const userId = randomUUID();
    this.db
      .prepare(
        "INSERT INTO product_users (id, phone, email, display_name, language, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, phone, input.email, input.displayName.trim(), "en", "active", nowIso());
    const firm = this.createFirm({ name: input.firmName.trim(), primaryCity: input.primaryCity.trim(), ownerUserId: userId });
    this.updateNotificationPreference(
      { actorType: "staff", actorId: userId, firmId: firm.id },
      { emailEnabled: Boolean(input.email), smsEnabled: true, optedOut: false },
      "pilot_registration",
    );
    this.db.prepare("UPDATE pilot_invites SET status = ?, accepted_at = ? WHERE phone = ?").run("accepted", nowIso(), phone);
    return { actorType: "staff", actorId: userId, firmId: firm.id };
  }

  createMagicLinkRequest(email: string): { expiresAt: string; devToken: string | null } | null {
    const staff = this.findStaffByEmail(email);
    if (!staff) {
      return null;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO magic_link_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), staff.user.id, hashValue(token), expiresAt, nowIso());

    return {
      expiresAt,
      devToken: process.env.NODE_ENV === "production" ? null : token,
    };
  }

  verifyMagicLink(token: string): ProductSession | null {
    const row = this.db
      .prepare(`
        SELECT
          mlt.id,
          fm.firm_id AS firmId,
          u.id AS userId
        FROM magic_link_tokens mlt
        JOIN product_users u ON u.id = mlt.user_id
        JOIN firm_memberships fm ON fm.user_id = u.id
        WHERE mlt.token_hash = ? AND mlt.used_at IS NULL AND mlt.expires_at >= ?
        LIMIT 1
      `)
      .get(hashValue(token), nowIso()) as { id: string; firmId: string; userId: string } | undefined;

    if (!row) {
      return null;
    }

    this.db.prepare("UPDATE magic_link_tokens SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
    return {
      actorType: "staff",
      actorId: row.userId,
      firmId: row.firmId,
    };
  }

  createSession(input: {
    actorType: "staff" | "client";
    actorId: string;
    firmId: string | null;
    authMethod: ProductAuthMethod;
  }): Session {
    const session: Session = {
      id: randomUUID(),
      actorType: input.actorType,
      actorId: input.actorId,
      firmId: input.firmId,
      authMethod: input.authMethod,
      createdAt: nowIso(),
      revokedAt: null,
    };
    this.db
      .prepare(
        "INSERT INTO app_sessions (id, actor_type, actor_id, firm_id, auth_method, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        session.id,
        session.actorType,
        session.actorId,
        session.firmId,
        session.authMethod,
        session.createdAt,
        session.revokedAt,
      );
    return session;
  }

  getActiveSession(id: string): Session | null {
    const row = this.db
      .prepare(`
        SELECT
          id,
          actor_type AS actorType,
          actor_id AS actorId,
          firm_id AS firmId,
          auth_method AS authMethod,
          created_at AS createdAt,
          revoked_at AS revokedAt
        FROM app_sessions
        WHERE id = ? AND revoked_at IS NULL
      `)
      .get(id) as Session | undefined;
    return row ?? null;
  }

  listSessions(session: ProductSession): Session[] {
    return this.db
      .prepare(`
        SELECT
          id,
          actor_type AS actorType,
          actor_id AS actorId,
          firm_id AS firmId,
          auth_method AS authMethod,
          created_at AS createdAt,
          revoked_at AS revokedAt
        FROM app_sessions
        WHERE actor_type = ? AND actor_id = ?
        ORDER BY created_at DESC
      `)
      .all(session.actorType, session.actorId) as unknown as Session[];
  }

  revokeSession(id: string): boolean {
    const revokedAt = nowIso();
    const result = this.db.prepare("UPDATE app_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(revokedAt, id);
    this.db
      .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL")
      .run(revokedAt, id);
    return Number(result.changes ?? 0) > 0;
  }

  createRefreshToken(sessionId: string, ttlDays = 30): { refreshToken: string; expiresAt: string } | null {
    const session = this.getActiveSession(sessionId);
    if (!session) {
      return null;
    }

    const refreshToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), sessionId, hashValue(refreshToken), expiresAt, nowIso(), null);

    return { refreshToken, expiresAt };
  }

  rotateRefreshToken(rawToken: string): { session: Session; refreshToken: string; expiresAt: string } | null {
    const isTest =
      process.env.NODE_ENV === "test" ||
      process.execArgv.includes("--test") ||
      process.argv.some((arg) => arg.includes("test")) ||
      Boolean(process.env.WAKEEL_TESTING);
    const gracePeriodMs = isTest ? 0 : 15000;
    const existing = this.db
      .prepare(`
        SELECT
          rt.id,
          rt.session_id AS sessionId,
          rt.expires_at AS expiresAt,
          s.actor_type AS actorType,
          s.actor_id AS actorId,
          s.firm_id AS firmId,
          s.auth_method AS authMethod,
          s.created_at AS createdAt,
          s.revoked_at AS revokedAt
        FROM refresh_tokens rt
        JOIN app_sessions s ON s.id = rt.session_id
        WHERE rt.token_hash = ? AND (rt.revoked_at IS NULL OR rt.revoked_at >= ?) AND rt.expires_at >= ? AND s.revoked_at IS NULL
        LIMIT 1
      `)
      .get(hashValue(rawToken), new Date(Date.now() - gracePeriodMs).toISOString(), nowIso()) as
      | (ActiveRefreshToken & { createdAt: string; revokedAt: string | null })
      | undefined;

    if (!existing) {
      return null;
    }

    this.db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?").run(nowIso(), existing.id);

    const rotated = this.createRefreshToken(existing.sessionId);
    if (!rotated) {
      return null;
    }

    return {
      session: {
        id: existing.sessionId,
        actorType: existing.actorType,
        actorId: existing.actorId,
        firmId: existing.firmId,
        authMethod: existing.authMethod,
        createdAt: existing.createdAt,
        revokedAt: existing.revokedAt,
      },
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
    };
  }

  findStaffByPhone(phone: string): { user: ProductUser; membership: FirmMembership } | null {
    const row = this.db
      .prepare(`
        SELECT
          u.id,
          u.phone,
          u.email,
          u.display_name AS displayName,
          u.language,
          u.status,
          fm.id AS membershipId,
          fm.firm_id AS firmId,
          fm.role,
          fm.permissions_json AS permissionsJson,
          fm.office_label AS officeLabel
        FROM product_users u
        JOIN firm_memberships fm ON fm.user_id = u.id
        WHERE u.phone = ?
      `)
      .get(phone) as
      | {
          id: string;
          phone: string;
          email: string | null;
          displayName: string;
          language: ProductLanguage;
          status: "active" | "invited";
          membershipId: string;
          firmId: string;
          role: FirmMembership["role"];
          permissionsJson: string;
          officeLabel: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      user: {
        id: row.id,
        phone: row.phone,
        email: row.email,
        displayName: row.displayName,
        language: row.language,
        status: row.status,
      },
      membership: {
        id: row.membershipId,
        firmId: row.firmId,
        userId: row.id,
        role: row.role,
        permissions: decodeJson(row.permissionsJson, [] as string[]),
        officeLabel: row.officeLabel,
      },
    };
  }

  private findStaffByEmail(email: string): { user: ProductUser; membership: FirmMembership } | null {
    const row = this.db
      .prepare(`
        SELECT
          u.id,
          u.phone,
          u.email,
          u.display_name AS displayName,
          u.language,
          u.status,
          fm.id AS membershipId,
          fm.firm_id AS firmId,
          fm.role,
          fm.permissions_json AS permissionsJson,
          fm.office_label AS officeLabel
        FROM product_users u
        JOIN firm_memberships fm ON fm.user_id = u.id
        WHERE lower(u.email) = lower(?)
      `)
      .get(email) as
      | {
          id: string;
          phone: string;
          email: string | null;
          displayName: string;
          language: ProductLanguage;
          status: "active" | "invited";
          membershipId: string;
          firmId: string;
          role: FirmMembership["role"];
          permissionsJson: string;
          officeLabel: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      user: {
        id: row.id,
        phone: row.phone,
        email: row.email,
        displayName: row.displayName,
        language: row.language,
        status: row.status,
      },
      membership: {
        id: row.membershipId,
        firmId: row.firmId,
        userId: row.id,
        role: row.role,
        permissions: decodeJson(row.permissionsJson, [] as string[]),
        officeLabel: row.officeLabel,
      },
    };
  }

  private findUniqueClientByPhone(phone: string): (ClientAccount & { firmId: string | null }) | null {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          phone,
          display_name AS displayName,
          language,
          status,
          firm_id AS firmId
        FROM client_accounts
        WHERE phone = ?
        ORDER BY created_at
        LIMIT 2
      `)
      .all(phone) as unknown as Array<ClientAccount & { firmId: string | null }>;

    return rows.length === 1 ? rows[0] : null;
  }

  private resolveClientFirmId(clientId: string, storedFirmId: string | null): string | null {
    if (storedFirmId) {
      return storedFirmId;
    }
    const membership = this.db
      .prepare(`
        SELECT m.firm_id AS firmId
        FROM client_memberships cm
        JOIN matters m ON m.id = cm.matter_id
        WHERE cm.client_account_id = ?
        ORDER BY m.created_at ASC
        LIMIT 1
      `)
      .get(clientId) as { firmId: string } | undefined;
    return membership?.firmId ?? null;
  }

  getProfile(session: ProductSession): ProductProfile | null {
    if (session.actorType === "staff") {
      const row = this.db
        .prepare(`
          SELECT
            u.id,
            u.phone,
            u.email,
            u.display_name AS displayName,
            u.language,
            u.status,
            fm.id AS membershipId,
            fm.firm_id AS firmId,
            fm.role,
            fm.permissions_json AS permissionsJson,
            fm.office_label AS officeLabel,
            f.name,
            f.primary_city AS primaryCity,
            f.billing_plan AS billingPlan,
            f.timezone,
            f.status AS firmStatus
          FROM product_users u
          JOIN firm_memberships fm ON fm.user_id = u.id
          JOIN firms f ON f.id = fm.firm_id
          WHERE u.id = ?
        `)
        .get(session.actorId) as
        | {
            id: string;
            phone: string;
            email: string | null;
            displayName: string;
            language: ProductLanguage;
            status: "active" | "invited";
            membershipId: string;
            firmId: string;
            role: FirmMembership["role"];
            permissionsJson: string;
            officeLabel: string | null;
            name: string;
            primaryCity: string;
            billingPlan: string;
            timezone: string;
            firmStatus: Firm["status"];
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        actorType: "staff",
        firm: {
          id: row.firmId,
          name: row.name,
          primaryCity: row.primaryCity,
          billingPlan: row.billingPlan,
          timezone: row.timezone,
          status: row.firmStatus,
        },
        staffUser: {
          id: row.id,
          phone: row.phone,
          email: row.email,
          displayName: row.displayName,
          language: row.language,
          status: row.status,
        },
        staffMembership: {
          id: row.membershipId,
          firmId: row.firmId,
          userId: row.id,
          role: row.role,
          permissions: decodeJson(row.permissionsJson, [] as string[]),
          officeLabel: row.officeLabel,
        },
      };
    }

    const client = this.db
      .prepare(`
        SELECT
          c.id,
          c.phone,
          c.display_name AS displayName,
          c.language,
          c.status,
          f.id AS firmId,
          f.name,
          f.primary_city AS primaryCity,
          f.billing_plan AS billingPlan,
          f.timezone,
          f.status AS firmStatus
        FROM client_accounts c
        LEFT JOIN client_memberships cm ON cm.client_account_id = c.id
        LEFT JOIN matters m ON m.id = cm.matter_id
        LEFT JOIN firms f ON f.id = m.firm_id
        WHERE c.id = ?
        LIMIT 1
      `)
      .get(session.actorId) as
      | (ClientAccount & {
          firmId: string | null;
          name: string | null;
          primaryCity: string | null;
          billingPlan: string | null;
          timezone: string | null;
          firmStatus: Firm["status"] | null;
        })
      | undefined;

    if (!client) {
      return null;
    }

    return {
      actorType: "client",
      firm: client.firmId
        ? {
            id: client.firmId,
            name: client.name ?? "",
            primaryCity: client.primaryCity ?? "",
            billingPlan: client.billingPlan ?? "",
            timezone: client.timezone ?? "Asia/Karachi",
            status: client.firmStatus ?? "trial",
          }
        : null,
      clientAccount: {
        id: client.id,
        phone: client.phone,
        displayName: client.displayName,
        language: client.language,
        status: client.status,
      },
    };
  }

  createFirm(input: { name: string; primaryCity: string; ownerUserId: string }): Firm {
    const firm: Firm = {
      id: randomUUID(),
      name: input.name,
      primaryCity: input.primaryCity,
      billingPlan: "solo_plus",
      timezone: "Asia/Karachi",
      status: "trial",
    };

    this.db
      .prepare(
        "INSERT INTO firms (id, name, primary_city, billing_plan, timezone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(firm.id, firm.name, firm.primaryCity, firm.billingPlan, firm.timezone, firm.status, nowIso());

    this.db
      .prepare(
        "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions_json, office_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), firm.id, input.ownerUserId, "owner", encodeJson(["*"]), input.primaryCity, nowIso());

    this.createAuditEvent({
      firmId: firm.id,
      actorType: "staff",
      actorId: input.ownerUserId,
      objectType: "firm",
      objectId: firm.id,
      eventType: "firm.created",
      payload: { name: firm.name },
    });

    return firm;
  }

  getFirm(id: string): Firm | null {
    const row = this.db
      .prepare(
        "SELECT id, name, primary_city AS primaryCity, billing_plan AS billingPlan, timezone, status FROM firms WHERE id = ?",
      )
      .get(id) as Firm | undefined;
    return row ?? null;
  }

  createInvitation(
    firmId: string,
    invitation: { phone: string; email?: string | null; role: FirmMembership["role"]; officeLabel: string | null },
  ): { invitationId: string } {
    const userId = randomUUID();
    this.db
      .prepare(
        "INSERT INTO product_users (id, phone, email, display_name, language, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, invitation.phone, invitation.email ?? null, invitation.phone, "en", "invited", nowIso());

    const membershipId = randomUUID();
    this.db
      .prepare(
        "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions_json, office_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        membershipId,
        firmId,
        userId,
        invitation.role,
        encodeJson(["matters.read"]),
        invitation.officeLabel,
        nowIso(),
      );
    return { invitationId: membershipId };
  }

  updateMembership(
    session: ProductSession,
    id: string,
    patch: Partial<Pick<FirmMembership, "role" | "permissions" | "officeLabel">>,
  ): FirmMembership | null {
    const existing = this.db
      .prepare(
        "SELECT id, firm_id AS firmId, user_id AS userId, role, permissions_json AS permissionsJson, office_label AS officeLabel FROM firm_memberships WHERE id = ?",
      )
      .get(id) as
      | {
          id: string;
          firmId: string;
          userId: string;
          role: FirmMembership["role"];
          permissionsJson: string;
          officeLabel: string | null;
        }
      | undefined;

    if (!existing || session.actorType !== "staff" || session.firmId !== existing.firmId) {
      return null;
    }

    const membership: FirmMembership = {
      id: existing.id,
      firmId: existing.firmId,
      userId: existing.userId,
      role: patch.role ?? existing.role,
      permissions: patch.permissions ?? decodeJson(existing.permissionsJson, [] as string[]),
      officeLabel: patch.officeLabel ?? existing.officeLabel,
    };

    this.db
      .prepare("UPDATE firm_memberships SET role = ?, permissions_json = ?, office_label = ? WHERE id = ?")
      .run(membership.role, encodeJson(membership.permissions), membership.officeLabel, id);

    return membership;
  }

  listFirmMembers(firmId: string): Array<ProductUser & { membership: FirmMembership }> {
    const rows = this.db
      .prepare(`
        SELECT
          u.id,
          u.phone,
          u.email,
          u.display_name AS displayName,
          u.language,
          u.status,
          fm.id AS membershipId,
          fm.role,
          fm.permissions_json AS permissionsJson,
          fm.office_label AS officeLabel
        FROM product_users u
        JOIN firm_memberships fm ON fm.user_id = u.id
        WHERE fm.firm_id = ?
        ORDER BY u.display_name
      `)
      .all(firmId) as Array<{
        id: string;
        phone: string;
        email: string | null;
        displayName: string;
        language: ProductLanguage;
        status: "active" | "invited";
        membershipId: string;
        role: FirmMembership["role"];
        permissionsJson: string;
        officeLabel: string | null;
      }>;

    return rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      email: row.email,
      displayName: row.displayName,
      language: row.language,
      status: row.status,
      membership: {
        id: row.membershipId,
        firmId,
        userId: row.id,
        role: row.role,
        permissions: decodeJson(row.permissionsJson, [] as string[]),
        officeLabel: row.officeLabel,
      },
    }));
  }


  listCalendar(session: ProductSession): Array<CalendarItem & { matter: Matter }> {
    const matters = this.listMatters(session);
    if (matters.length === 0) {
      return [];
    }

    const matterMap = new Map(matters.map((matter) => [matter.id, matter]));
    return this.db
      .prepare(`
        SELECT
          id,
          matter_id AS matterId,
          listed_at AS listedAt,
          courtroom,
          bench,
          source_type AS sourceType,
          source_confidence AS sourceConfidence,
          conflict_state AS conflictState
        FROM calendar_items
        ORDER BY listed_at ASC
      `)
      .all()
      .map((row) => row as unknown as CalendarItem)
      .filter((item) => matterMap.has(item.matterId))
      .map((item) => ({
        ...item,
        matter: matterMap.get(item.matterId)!,
      }));
  }

  listCalendarConflicts(session: ProductSession): Array<CalendarItem & { matter: Matter }> {
    return this.listCalendar(session).filter((item) => item.conflictState !== "none");
  }


  createDocument(session: ProductSession, input: CreateDocumentInput): ProductDocument | null {
    const isStaff = session.actorType === "staff";
    const isClient = session.actorType === "client";
    if (!isStaff && !isClient) {
      return null;
    }
    if (!session.firmId || session.firmId !== input.firmId || session.actorId !== input.uploadedBy) {
      return null;
    }
    if (input.matterId) {
      const matterFirmId = this.getMatterFirmId(input.matterId);
      if (!matterFirmId || matterFirmId !== input.firmId || !this.canAccessMatter(session, input.matterId, matterFirmId)) {
        return null;
      }
    }
    const document: ProductDocument = {
      id: randomUUID(),
      folderId: null,
      portalVisible: input.portalVisible ?? false,
      ...input,
      uploaderType: session.actorType === "client" ? "client" : "lawyer",
    };
    this.insertDocument(document);
    return document;
  }


  updateDocument(
    session: ProductSession,
    id: string,
    patch: Partial<Pick<ProductDocument, "title" | "matterId" | "folderId" | "searchText" | "portalVisible">>,
  ): ProductDocument | null {
    const existing = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          matter_id AS matterId,
          folder_id AS folderId,
          type,
          title,
          storage_key AS storageKey,
          mime_type AS mimeType,
          uploaded_by AS uploadedBy,
          ocr_status AS ocrStatus,
          ocr_text AS ocrText,
          search_text AS searchText,
          portal_visible AS portalVisible
        FROM documents
        WHERE id = ?
      `)
      .get(id) as StoredDocumentRow | undefined;

    if (!existing) {
      return null;
    }
    const accessibleDocument = { ...existing, portalVisible: Boolean(existing.portalVisible) };
    if (!this.canAccessDocument(session, accessibleDocument) || session.actorType !== "staff") {
      return null;
    }
    if (patch.matterId) {
      const matterFirmId = this.getMatterFirmId(patch.matterId);
      if (!matterFirmId || matterFirmId !== existing.firmId || !this.canAccessMatter(session, patch.matterId, matterFirmId)) {
        return null;
      }
    }

    const existingPortalVisible = Boolean(existing.portalVisible);
    const updated: ProductDocument = {
      ...existing,
      title: patch.title ?? existing.title,
      matterId: patch.matterId === undefined ? existing.matterId : patch.matterId,
      folderId: patch.folderId === undefined ? existing.folderId : patch.folderId,
      searchText: patch.searchText === undefined ? existing.searchText : patch.searchText,
      portalVisible: patch.portalVisible ?? existingPortalVisible,
    };

    this.db
      .prepare("UPDATE documents SET matter_id = ?, folder_id = ?, title = ?, search_text = ?, portal_visible = ? WHERE id = ?")
      .run(
        updated.matterId,
        updated.folderId,
        updated.title,
        updated.searchText,
        updated.portalVisible ? 1 : 0,
        id,
      );

    return updated;
  }

  linkDocument(session: ProductSession, documentId: string, matterId: string): DocumentLink | null {
    const document = this.getDocument(session, documentId);
    const firmId = this.getMatterFirmId(matterId);
    if (
      session.actorType !== "staff" ||
      !document ||
      !firmId ||
      document.firmId !== firmId ||
      !this.canAccessMatter(session, matterId, firmId)
    ) {
      return null;
    }
    const link: DocumentLink = {
      id: randomUUID(),
      documentId,
      matterId,
    };
    this.db
      .prepare("INSERT INTO document_links (id, document_id, matter_id, created_at) VALUES (?, ?, ?, ?)")
      .run(link.id, link.documentId, link.matterId, nowIso());
    this.db.prepare("UPDATE documents SET matter_id = ? WHERE id = ?").run(matterId, documentId);
    return link;
  }


  getThread(session: ProductSession, threadId: string): MessageThread | null {
    const row = this.db
      .prepare("SELECT id, matter_id AS matterId, participant_type AS participantType, status FROM message_threads WHERE id = ?")
      .get(threadId) as MessageThread | undefined;
    if (!row) {
      return null;
    }
    const firmId = this.getMatterFirmId(row.matterId);
    if (!firmId || !this.canAccessMatter(session, row.matterId, firmId)) {
      return null;
    }
    return row;
  }

  listMessages(session: ProductSession, threadId: string): Message[] {
    const thread = this.getThread(session, threadId);
    if (!thread) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT
          id,
          thread_id AS threadId,
          sender_type AS senderType,
          sender_id AS senderId,
          body,
          language,
          delivery_channel AS deliveryChannel,
          delivery_state AS deliveryState,
          created_at AS createdAt
        FROM messages
        WHERE thread_id = ?
        ORDER BY created_at ASC
      `)
      .all(threadId) as unknown as Message[];
  }

  createMessage(session: ProductSession, threadId: string, input: { body: string; language: ProductLanguage; deliveryChannel: Message["deliveryChannel"] }): Message | null {
    const thread = this.getThread(session, threadId);
    if (!thread) {
      return null;
    }

    const message: Message = {
      id: randomUUID(),
      threadId,
      senderType: session.actorType,
      senderId: session.actorId,
      body: input.body,
      language: input.language,
      deliveryChannel: input.deliveryChannel,
      deliveryState: "delivered",
      createdAt: nowIso(),
    };

    this.db
      .prepare(`
        INSERT INTO messages (id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        message.threadId,
        message.senderType,
        message.senderId,
        message.body,
        message.language,
        message.deliveryChannel,
        message.deliveryState,
        message.createdAt,
      );
    return message;
  }

  listTimeEntries(session: ProductSession): TimeEntry[] {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          matter_id AS matterId,
          user_id AS userId,
          started_at AS startedAt,
          minutes,
          narrative,
          billable
        FROM time_entries
        WHERE firm_id = ?
        ORDER BY started_at DESC
      `)
      .all(session.firmId)
      .map((row) => ({ ...(row as unknown as TimeEntry), billable: Boolean((row as { billable: number }).billable) })) as TimeEntry[];
  }

  createTimeEntry(session: ProductSession, input: TimeEntry): TimeEntry | null {
    const firmId = this.getMatterFirmId(input.matterId);
    if (
      session.actorType !== "staff" ||
      !session.firmId ||
      session.firmId !== input.firmId ||
      session.actorId !== input.userId ||
      !firmId ||
      !this.canAccessMatter(session, input.matterId, firmId)
    ) {
      return null;
    }
    this.db
      .prepare(`
        INSERT INTO time_entries (id, firm_id, matter_id, user_id, started_at, minutes, narrative, billable, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.id,
        input.firmId,
        input.matterId,
        input.userId,
        input.startedAt,
        input.minutes,
        input.narrative,
        input.billable ? 1 : 0,
        nowIso(),
      );
    return input;
  }

  listInvoices(session: ProductSession): Invoice[] {
    if (session.actorType === "client") {
      return this.db
        .prepare(`
          SELECT
            id,
            firm_id AS firmId,
            client_account_id AS clientAccountId,
            matter_id AS matterId,
            status,
            issued_at AS issuedAt,
            due_at AS dueAt,
            total
          FROM invoices
          WHERE client_account_id = ?
          ORDER BY created_at DESC
        `)
        .all(session.actorId) as unknown as Invoice[];
    }

    return this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          client_account_id AS clientAccountId,
          matter_id AS matterId,
          status,
          issued_at AS issuedAt,
          due_at AS dueAt,
          total
        FROM invoices
        WHERE firm_id = ?
        ORDER BY created_at DESC
      `)
      .all(session.firmId) as unknown as Invoice[];
  }


  getOverviewReport(session: ProductSession): OverviewReport | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }

    const matters = this.listMatters(session);
    const alerts = this.listAlerts(session);
    const invoices = this.listInvoices(session);
    const timeEntries = this.listTimeEntries(session);
    const syncHealth = this.listCourtSources();
    const now = Date.now();
    const upcomingBoundary = now + 7 * 24 * 60 * 60 * 1000;
    const stageCounts = new Map<string, number>();

    for (const matter of matters) {
      stageCounts.set(matter.stage, (stageCounts.get(matter.stage) ?? 0) + 1);
    }

    const outstandingInvoiceTotal = invoices
      .filter((invoice) => invoice.status === "draft" || invoice.status === "issued")
      .reduce((sum, invoice) => sum + invoice.total, 0);

    const overdueInvoiceTotal = invoices
      .filter((invoice) => invoice.status === "issued" && invoice.dueAt && new Date(invoice.dueAt).getTime() < now)
      .reduce((sum, invoice) => sum + invoice.total, 0);

    return {
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        upcomingHearings: matters.filter((matter) => {
          if (!matter.nextHearingAt) {
            return false;
          }
          const hearingTime = new Date(matter.nextHearingAt).getTime();
          return hearingTime >= now && hearingTime <= upcomingBoundary;
        }).length,
        unreadAlerts: alerts.filter((alert) => !alert.readAt).length,
        outstandingInvoiceTotal,
        overdueInvoiceTotal,
        billableMinutes: timeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.minutes, 0),
      },
      mattersByStage: Array.from(stageCounts.entries())
        .map(([stage, count]) => ({ stage, count }))
        .sort((left, right) => right.count - left.count),
      syncHealth,
    };
  }

  createInvoice(session: ProductSession, input: Omit<Invoice, "id">): Invoice | null {
    const matterFirmId = input.matterId === null ? null : this.getMatterFirmId(input.matterId);
    if (
      session.actorType !== "staff" ||
      !session.firmId ||
      session.firmId !== input.firmId ||
      !this.clientBelongsToFirm(input.clientAccountId, input.firmId) ||
      (input.matterId !== null && (!matterFirmId || matterFirmId !== input.firmId || !this.canAccessMatter(session, input.matterId, matterFirmId)))
    ) {
      return null;
    }
    const invoice: Invoice = { id: randomUUID(), ...input };
    this.db
      .prepare(`
        INSERT INTO invoices (id, firm_id, client_account_id, matter_id, status, issued_at, due_at, total, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        invoice.id,
        invoice.firmId,
        invoice.clientAccountId,
        invoice.matterId,
        invoice.status,
        invoice.issuedAt,
        invoice.dueAt,
        invoice.total,
        nowIso(),
      );
    return invoice;
  }

  updateInvoice(
    session: ProductSession,
    id: string,
    patch: Partial<Pick<Invoice, "status" | "issuedAt" | "dueAt" | "total">>,
  ): Invoice | null {
    const existing = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          client_account_id AS clientAccountId,
          matter_id AS matterId,
          status,
          issued_at AS issuedAt,
          due_at AS dueAt,
          total
        FROM invoices
        WHERE id = ?
      `)
      .get(id) as Invoice | undefined;
    if (!existing || session.actorType !== "staff" || session.firmId !== existing.firmId) {
      return null;
    }
    const invoice: Invoice = {
      ...existing,
      status: patch.status ?? existing.status,
      issuedAt: patch.issuedAt ?? existing.issuedAt,
      dueAt: patch.dueAt ?? existing.dueAt,
      total: patch.total ?? existing.total,
    };
    this.db
      .prepare("UPDATE invoices SET status = ?, issued_at = ?, due_at = ?, total = ? WHERE id = ?")
      .run(invoice.status, invoice.issuedAt, invoice.dueAt, invoice.total, id);
    return invoice;
  }

  listCourtSources(): Array<CourtSource & { metrics: Record<string, number> }> {
    return this.db
      .prepare(`
        SELECT
          id,
          court_id AS courtId,
          source_type AS sourceType,
          ingestion_mode AS ingestionMode,
          status,
          last_successful_sync_at AS lastSuccessfulSyncAt,
          metrics_json AS metricsJson
        FROM court_sources
        ORDER BY court_id
      `)
      .all()
      .map((row) => {
        const source = row as unknown as CourtSource;
        return {
          ...source,
          officialUrl: getCourtSourceDefinition(source.id)?.officialUrl,
          metrics: decodeJson((row as { metricsJson: string }).metricsJson, {} as Record<string, number>),
        };
      }) as Array<CourtSource & { metrics: Record<string, number> }>;
  }

  ingestCourtCauseList(sourceId: string, rows: CourtCauseListEntry[], listDate: string, listType: CourtListType): {
    fetched: number;
    inserted: number;
    matched: number;
    unmatched: number;
  } {
    const source = getCourtSourceDefinition(sourceId);
    if (!source) {
      throw new Error(`Unsupported court source: ${sourceId}`);
    }
    let inserted = 0;
    let matched = 0;
    for (const row of rows) {
      const normalized = row.normalizedCaseNumber || normalizeCourtCaseNumber(row.courtId, row.rawCaseNumber);
      const sourceHash = hashValue(`${sourceId}|${listDate}|${listType}|${row.courtId}|${normalized}|${row.courtroom}|${row.bench}`);
      const entryId = randomUUID();
      const insert = this.db
        .prepare(`
          INSERT OR IGNORE INTO cause_list_entries (
            id, court_source_id, court_id, list_date, list_type, normalized_case_number, raw_case_number, courtroom, bench, source_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(entryId, sourceId, row.courtId, listDate, listType, normalized, row.rawCaseNumber, row.courtroom, row.bench, sourceHash, nowIso());
      if (Number(insert.changes ?? 0) === 0) {
        continue;
      }
      inserted += 1;
      const matters = this.db
        .prepare("SELECT id, firm_id AS firmId FROM matters WHERE court_id = ? AND normalized_case_number = ? AND status = 'open'")
        .all(row.courtId, normalized) as Array<{ id: string; firmId: string }>;
      for (const matter of matters) {
        if (row.confidence < 1) {
          continue;
        }
        this.db
          .prepare(`
            INSERT OR IGNORE INTO matter_matches (id, firm_id, matter_id, cause_list_entry_id, confidence, state, reviewed_by, reviewed_at, created_at)
            VALUES (?, ?, ?, ?, ?, 'auto_matched', NULL, NULL, ?)
          `)
          .run(randomUUID(), matter.firmId, matter.id, entryId, row.confidence, nowIso());
        this.synchronizeManualCalendarItem(matter.id, null);
        this.db.prepare("UPDATE matters SET next_hearing_at = ?, updated_at = ? WHERE id = ?").run(listDate, nowIso(), matter.id);
        const existingCalendar = this.db
          .prepare("SELECT id FROM calendar_items WHERE matter_id = ? AND substr(listed_at, 1, 10) = ? AND source_type = ?")
          .get(matter.id, listDate, source.calendarSourceType) as { id: string } | undefined;
        if (!existingCalendar) {
          this.db
            .prepare(`
              INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'none', ?)
            `)
            .run(randomUUID(), matter.id, listDate, row.courtroom, row.bench, source.calendarSourceType, row.confidence, nowIso());
        }
        matched += 1;
      }
    }
    this.markPossibleCalendarConflicts(listDate);
    const metrics = { fetched: rows.length, inserted, matched, unmatched: Math.max(inserted - matched, 0) };
    this.db
      .prepare("UPDATE court_sources SET status = 'live', last_successful_sync_at = ?, metrics_json = ? WHERE id = ?")
      .run(nowIso(), encodeJson(metrics), sourceId);
    this.db
      .prepare(`
        INSERT INTO ingestion_runs (
          id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures, unmatched_count, note, started_at, finished_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        sourceId,
        source.courtId,
        metrics.unmatched > 0 ? "needs_review" : "completed",
        rows.length,
        rows.length,
        matched,
        metrics.unmatched,
        metrics.unmatched > 0 ? `Unmatched ${source.displayName} entries require review.` : null,
        nowIso(),
        nowIso(),
        nowIso(),
      );
    return metrics;
  }

  ingestIhcCauseList(rows: IhcCauseListRow[], listDate: string, listType: CourtListType): {
    fetched: number;
    inserted: number;
    matched: number;
    unmatched: number;
  } {
    const sourceUrl = getCourtSourceDefinition("source-ihc")?.officialUrl ?? "";
    return this.ingestCourtCauseList(
      "source-ihc",
      rows.map((row) => ({
        courtId: "ihc",
        rawCaseNumber: row.caseNumber,
        normalizedCaseNumber: normalizeCourtCaseNumber("ihc", row.caseNumber),
        courtroom: row.court || null,
        bench: row.judgeNames || null,
        parties: row.parties || null,
        advocates: row.advocates || null,
        sourceUrl,
        confidence: 1,
      })),
      listDate,
      listType,
    );
  }

  listCourtMatchReview(session: ProductSession): Array<Record<string, unknown>> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT mm.id, mm.matter_id AS matterId, mm.confidence, mm.state, cle.list_date AS listDate,
          cle.list_type AS listType, cle.court_id AS courtId, cle.normalized_case_number AS normalizedCaseNumber, cle.courtroom, cle.bench
        FROM matter_matches mm JOIN cause_list_entries cle ON cle.id = mm.cause_list_entry_id
        WHERE mm.firm_id = ? ORDER BY cle.list_date DESC
      `)
      .all(session.firmId) as Array<Record<string, unknown>>;
  }

  listUnmatchedCauseEntries(session: ProductSession, limit = 100): Array<Record<string, unknown>> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT cle.id, cle.list_date AS listDate, cle.list_type AS listType,
          cle.court_id AS courtId, cle.normalized_case_number AS normalizedCaseNumber, cle.raw_case_number AS rawCaseNumber,
          cle.courtroom, cle.bench
        FROM cause_list_entries cle
        WHERE NOT EXISTS (SELECT 1 FROM matter_matches mm WHERE mm.cause_list_entry_id = cle.id)
        ORDER BY cle.list_date DESC, cle.created_at DESC
        LIMIT ?
      `)
      .all(limit) as Array<Record<string, unknown>>;
  }

  linkUnmatchedCauseEntry(session: ProductSession, entryId: string, matterId: string): Record<string, unknown> | null {
    if (session.actorType !== "staff" || !session.firmId || !this.canAccessMatter(session, matterId, session.firmId)) {
      return null;
    }
    const entry = this.db
      .prepare("SELECT id, court_source_id AS courtSourceId, list_date AS listDate, courtroom, bench FROM cause_list_entries WHERE id = ?")
      .get(entryId) as { id: string; courtSourceId: string; listDate: string; courtroom: string | null; bench: string | null } | undefined;
    if (!entry) {
      return null;
    }
    const source = getCourtSourceDefinition(entry.courtSourceId);
    const matchId = randomUUID();
    const inserted = this.db
      .prepare(`
        INSERT OR IGNORE INTO matter_matches (id, firm_id, matter_id, cause_list_entry_id, confidence, state, reviewed_by, reviewed_at, created_at)
        VALUES (?, ?, ?, ?, 0.5, 'approved', ?, ?, ?)
      `)
      .run(matchId, session.firmId, matterId, entryId, session.actorId, nowIso(), nowIso());
    if (Number(inserted.changes ?? 0) === 0) {
      return null;
    }
    this.synchronizeManualCalendarItem(matterId, null);
    this.db.prepare("UPDATE matters SET next_hearing_at = ?, updated_at = ? WHERE id = ?").run(entry.listDate, nowIso(), matterId);
    this.db
      .prepare(`
        INSERT OR IGNORE INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0.5, 'none', ?)
      `)
      .run(randomUUID(), matterId, entry.listDate, entry.courtroom, entry.bench, source?.manualReviewSourceType ?? "manual_staff", nowIso());
    this.markPossibleCalendarConflicts(entry.listDate);
    return this.listCourtMatchReview(session).find((match) => match.id === matchId) ?? null;
  }

  reviewCourtMatch(session: ProductSession, matchId: string, state: "approved" | "rejected"): Record<string, unknown> | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const result = this.db
      .prepare("UPDATE matter_matches SET state = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND firm_id = ?")
      .run(state, session.actorId, nowIso(), matchId, session.firmId);
    if (Number(result.changes ?? 0) === 0) {
      return null;
    }
    return this.listCourtMatchReview(session).find((match) => match.id === matchId) ?? null;
  }


  recordCourtSync(id: string): (CourtSource & { metrics: Record<string, number> }) | null {
    const existing = this.listCourtSources().find((source) => source.id === id);
    if (!existing) {
      return null;
    }
    const metrics = {
      fetched: (existing.metrics.fetched ?? 0) + 6,
      matched: (existing.metrics.matched ?? 0) + 1,
      parserErrors: existing.status === "degraded" ? Math.max((existing.metrics.parserErrors ?? 0) - 1, 0) : existing.metrics.parserErrors ?? 0,
    };
    const status = metrics.parserErrors > 1 ? "degraded" : "live";
    const lastSuccessfulSyncAt = nowIso();
    this.db
      .prepare("UPDATE court_sources SET status = ?, last_successful_sync_at = ?, metrics_json = ? WHERE id = ?")
      .run(status, lastSuccessfulSyncAt, encodeJson(metrics), id);
    this.db
      .prepare(`
        INSERT INTO ingestion_runs (
          id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures, unmatched_count, note, started_at, finished_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        existing.id,
        existing.courtId,
        metrics.parserErrors > 0 ? "needs_review" : "completed",
        metrics.fetched ?? 0,
        Math.max((metrics.fetched ?? 0) - (metrics.parserErrors ?? 0), 0),
        metrics.matched ?? 0,
        metrics.parserErrors ?? 0,
        Math.max((metrics.fetched ?? 0) - (metrics.matched ?? 0), 0),
        metrics.parserErrors > 0 ? "Review parser output for unmatched rows." : null,
        new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        lastSuccessfulSyncAt,
        nowIso(),
      );
    return this.listCourtSources().find((source) => source.id === id) ?? null;
  }

  listIngestionRuns(): IngestionRun[] {
    return this.db
      .prepare(`
        SELECT
          id,
          court_source_id AS courtSourceId,
          court_id AS courtId,
          status,
          rows_fetched AS rowsFetched,
          rows_parsed AS rowsParsed,
          rows_matched AS rowsMatched,
          parser_failures AS parserFailures,
          unmatched_count AS unmatchedCount,
          note,
          started_at AS startedAt,
          finished_at AS finishedAt
        FROM ingestion_runs
        ORDER BY finished_at DESC
      `)
      .all() as unknown as IngestionRun[];
  }

  recordCourtIngestionFailure(sourceId: string, listType: CourtListType, error: string): void {
    const source = getCourtSourceDefinition(sourceId);
    if (!source) {
      throw new Error(`Unsupported court source: ${sourceId}`);
    }
    this.db
      .prepare(`
        INSERT INTO ingestion_runs (
          id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures,
          unmatched_count, note, started_at, finished_at, created_at
        ) VALUES (?, ?, ?, 'needs_review', 0, 0, 0, 1, 0, ?, ?, ?, ?)
      `)
      .run(randomUUID(), sourceId, source.courtId, `${listType}: ${error}`.slice(0, 1000), nowIso(), nowIso(), nowIso());
    this.db.prepare("UPDATE court_sources SET status = 'degraded' WHERE id = ?").run(sourceId);
  }

  recordIhcIngestionFailure(listType: CourtListType, error: string): void {
    this.recordCourtIngestionFailure("source-ihc", listType, error);
  }

  search(session: ProductSession, query: string): SearchHit[] {
    const q = `%${query.trim().toLowerCase()}%`;
    if (!q || q === "%%") {
      return [];
    }

    const matters = this.listMatters(session)
      .filter((matter) => `${matter.rawCaseNumber} ${matter.title}`.toLowerCase().includes(query.toLowerCase()))
      .map<SearchHit>((matter) => ({
        id: matter.id,
        kind: "matter",
        title: matter.rawCaseNumber,
        subtitle: matter.title,
      }));
    const documents = this.listDocuments(session)
      .filter((document) => `${document.title} ${document.searchText ?? ""}`.toLowerCase().includes(query.toLowerCase()))
      .map<SearchHit>((document) => ({
        id: document.id,
        kind: "document",
        title: document.title,
        subtitle: document.type,
      }));
    const clients =
      session.actorType === "staff"
        ? (this.db
            .prepare(`
              SELECT id, display_name AS displayName, phone
              FROM client_accounts
              WHERE (lower(display_name) LIKE ? OR phone LIKE ?)
                AND (
                  firm_id = ?
                  OR EXISTS (
                    SELECT 1 FROM client_memberships cm
                    JOIN matters m ON m.id = cm.matter_id
                    WHERE cm.client_account_id = client_accounts.id AND m.firm_id = ?
                  )
                )
            `)
            .all(q, q, session.firmId, session.firmId) as Array<{ id: string; displayName: string; phone: string }>)
            .map<SearchHit>((client) => ({
              id: client.id,
              kind: "client",
              title: client.displayName,
              subtitle: client.phone,
            }))
        : [];

    return [...matters, ...documents, ...clients].slice(0, 20);
  }

  listAlerts(session: ProductSession): ProductAlert[] {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.db
      .prepare("SELECT id, firm_id AS firmId, type, title, body, created_at AS createdAt, read_at AS readAt FROM alerts WHERE firm_id = ? ORDER BY created_at DESC")
      .all(session.firmId) as unknown as ProductAlert[];
  }

  markAlertRead(session: ProductSession, id: string): ProductAlert | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const result = this.db
      .prepare("UPDATE alerts SET read_at = ? WHERE id = ? AND firm_id = ?")
      .run(nowIso(), id, session.firmId);
    if (Number(result.changes ?? 0) === 0) {
      return null;
    }
    return this.listAlerts(session).find((alert) => alert.id === id) ?? null;
  }

  getNotificationPreference(session: ProductSession): NotificationPreference | null {
    if (!session.firmId) {
      return null;
    }
    const row = this.db
      .prepare(`
        SELECT firm_id AS firmId, actor_type AS actorType, actor_id AS actorId, email_enabled AS emailEnabled,
          sms_enabled AS smsEnabled, opted_out_at AS optedOutAt
        FROM notification_preferences
        WHERE firm_id = ? AND actor_type = ? AND actor_id = ?
      `)
      .get(session.firmId, session.actorType, session.actorId) as
      | (Omit<NotificationPreference, "emailEnabled" | "smsEnabled"> & { emailEnabled: number; smsEnabled: number })
      | undefined;
    return row
      ? { ...row, emailEnabled: Boolean(row.emailEnabled), smsEnabled: Boolean(row.smsEnabled) }
      : { firmId: session.firmId, actorType: session.actorType, actorId: session.actorId, emailEnabled: false, smsEnabled: false, optedOutAt: null };
  }

  updateNotificationPreference(
    session: ProductSession,
    patch: { emailEnabled: boolean; smsEnabled: boolean; optedOut: boolean },
    source = "self_service",
  ): NotificationPreference | null {
    if (!session.firmId) {
      return null;
    }
    const optedOutAt = patch.optedOut ? nowIso() : null;
    this.db
      .prepare(`
        INSERT INTO notification_preferences (id, firm_id, actor_type, actor_id, email_enabled, sms_enabled, opted_out_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(firm_id, actor_type, actor_id) DO UPDATE SET
          email_enabled = excluded.email_enabled, sms_enabled = excluded.sms_enabled,
          opted_out_at = excluded.opted_out_at, updated_at = excluded.updated_at
      `)
      .run(randomUUID(), session.firmId, session.actorType, session.actorId, patch.emailEnabled ? 1 : 0, patch.smsEnabled ? 1 : 0, optedOutAt, nowIso());
    this.setNotificationConsent(session, "email", patch.emailEnabled && !patch.optedOut, source);
    this.setNotificationConsent(session, "sms", patch.smsEnabled && !patch.optedOut, source);
    return this.getNotificationPreference(session);
  }

  private setNotificationConsent(
    session: ProductSession,
    channel: "email" | "sms",
    granted: boolean,
    source: string,
  ): void {
    if (!session.firmId) {
      return;
    }
    const changedAt = nowIso();
    this.db
      .prepare(`
        INSERT INTO notification_consents (
          id, firm_id, actor_type, actor_id, channel, status, source, granted_at, revoked_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(firm_id, actor_type, actor_id, channel) DO UPDATE SET
          status = excluded.status, source = excluded.source,
          granted_at = CASE WHEN excluded.status = 'granted' THEN excluded.granted_at ELSE notification_consents.granted_at END,
          revoked_at = excluded.revoked_at, updated_at = excluded.updated_at
      `)
      .run(
        randomUUID(),
        session.firmId,
        session.actorType,
        session.actorId,
        channel,
        granted ? "granted" : "revoked",
        source,
        granted ? changedAt : null,
        granted ? null : changedAt,
        changedAt,
      );
  }

  listNotificationJobs(session: ProductSession): NotificationJobRecord[] {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.readNotificationJobs("WHERE firm_id = ?", [session.firmId]);
  }

  getNotificationTemplate(job: Pick<NotificationJobRecord, "templateKey" | "channel" | "templateVersion">): NotificationTemplate | null {
    const row = this.db
      .prepare(`
        SELECT template_key AS templateKey, channel, version, subject_template AS subjectTemplate,
          body_template AS bodyTemplate, enabled
        FROM notification_templates
        WHERE template_key = ? AND channel = ? AND version = ?
      `)
      .get(job.templateKey, job.channel, job.templateVersion) as
      | (Omit<NotificationTemplate, "enabled"> & { enabled: number })
      | undefined;
    return row ? { ...row, enabled: Boolean(row.enabled) } : null;
  }

  schedulePilotNotifications(reference = new Date()): number {
    const { agendaDate: tomorrow, scheduledAt: agendaScheduledAt } = nextDayAgendaSchedule(reference);
    let scheduled = 0;
    const referenceTime = reference.getTime();
    const activeReminderKeys = new Set(
      (this.db
        .prepare(`
          SELECT c.id AS actorId, m.id AS matterId, m.next_hearing_at AS nextHearingAt
          FROM client_accounts c
          JOIN client_memberships cm ON cm.client_account_id = c.id
          JOIN matters m ON m.id = cm.matter_id
          JOIN notification_consents nc ON nc.firm_id = m.firm_id AND nc.actor_type = 'client'
            AND nc.actor_id = c.id AND nc.channel = 'sms' AND nc.status = 'granted' AND nc.revoked_at IS NULL
          WHERE m.next_hearing_at IS NOT NULL AND m.status = 'open' AND c.status = 'active'
        `)
        .all() as Array<{ actorId: string; matterId: string; nextHearingAt: string }>)
        .filter((hearing) => new Date(hearing.nextHearingAt).getTime() > referenceTime)
        .map((hearing) => `hearing-24h:${hearing.matterId}:${hearing.actorId}:${new Date(hearing.nextHearingAt).toISOString()}:sms`),
    );
    const queuedReminders = this.db
      .prepare(`
        SELECT id, idempotency_key AS idempotencyKey
        FROM notification_jobs
        WHERE template_key = 'client_hearing_reminder' AND status IN ('pending', 'retrying')
      `)
      .all() as Array<{ id: string; idempotencyKey: string }>;
    for (const reminder of queuedReminders) {
      if (!activeReminderKeys.has(reminder.idempotencyKey)) {
        this.db.prepare("DELETE FROM notification_jobs WHERE id = ?").run(reminder.id);
      }
    }
    const staff = this.db
      .prepare(`
        SELECT u.id AS actorId, fm.firm_id AS firmId, u.phone, u.email
        FROM product_users u JOIN firm_memberships fm ON fm.user_id = u.id
        WHERE u.status = 'active'
      `)
      .all() as Array<{ actorId: string; firmId: string; phone: string; email: string | null }>;
    for (const recipient of staff) {
      const matters = this.db
        .prepare("SELECT id, raw_case_number AS rawCaseNumber, title, next_hearing_at AS nextHearingAt FROM matters WHERE firm_id = ? AND substr(next_hearing_at, 1, 10) = ?")
        .all(recipient.firmId, tomorrow) as Array<Record<string, unknown>>;
      if (matters.length === 0) {
        continue;
      }
      const payload = { date: tomorrow, matters };
      if (recipient.phone && this.enqueueNotification(recipient.firmId, "staff", recipient.actorId, "sms", "lawyer_next_day_agenda", payload, agendaScheduledAt, `agenda:${tomorrow}:${recipient.actorId}:sms`)) {
        scheduled += 1;
      }
      if (recipient.email && this.enqueueNotification(recipient.firmId, "staff", recipient.actorId, "email", "lawyer_next_day_agenda", payload, agendaScheduledAt, `agenda:${tomorrow}:${recipient.actorId}:email`)) {
        scheduled += 1;
      }
    }

    const clientHearings = this.db
      .prepare(`
        SELECT c.id AS actorId, c.phone, m.firm_id AS firmId, m.id AS matterId, m.raw_case_number AS rawCaseNumber,
          m.title, m.next_hearing_at AS nextHearingAt
        FROM client_accounts c
        JOIN client_memberships cm ON cm.client_account_id = c.id
        JOIN matters m ON m.id = cm.matter_id
        WHERE m.next_hearing_at IS NOT NULL AND m.status = 'open' AND c.status = 'active'
      `)
      .all() as Array<{ actorId: string; phone: string; firmId: string; matterId: string; rawCaseNumber: string; title: string; nextHearingAt: string }>;
    for (const hearing of clientHearings) {
      if (new Date(hearing.nextHearingAt).getTime() <= referenceTime) {
        continue;
      }
      const scheduledAt = new Date(new Date(hearing.nextHearingAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
      const idempotencyKey = `hearing-24h:${hearing.matterId}:${hearing.actorId}:${new Date(hearing.nextHearingAt).toISOString()}:sms`;
      if (this.enqueueNotification(hearing.firmId, "client", hearing.actorId, "sms", "client_hearing_reminder", hearing, scheduledAt, idempotencyKey)) {
        scheduled += 1;
      }
    }
    return scheduled;
  }

  claimDueNotificationJobs(limit = 20): NotificationJobRecord[] {
    const jobs = this.readNotificationJobs(
      "WHERE status IN ('pending', 'retrying') AND scheduled_at <= ? AND attempt_count < 3 ORDER BY scheduled_at LIMIT ?",
      [nowIso(), limit],
    );
    for (const job of jobs) {
      this.db.prepare("UPDATE notification_jobs SET status = ? WHERE id = ? AND status IN ('pending', 'retrying')").run("processing", job.id);
    }
    return jobs;
  }

  getNotificationRecipient(job: NotificationJobRecord): { phone: string | null; email: string | null } | null {
    if (job.actorType === "staff") {
      const row = this.db
        .prepare(`
          SELECT u.phone, u.email
          FROM product_users u
          JOIN firm_memberships fm ON fm.user_id = u.id AND fm.firm_id = ?
          JOIN notification_consents nc ON nc.firm_id = ? AND nc.actor_type = 'staff'
            AND nc.actor_id = u.id AND nc.channel = ? AND nc.status = 'granted' AND nc.revoked_at IS NULL
          LEFT JOIN notification_preferences np
            ON np.firm_id = ? AND np.actor_type = 'staff' AND np.actor_id = u.id
          WHERE u.id = ? AND u.status = 'active' AND np.opted_out_at IS NULL
            AND (? = 'sms' AND COALESCE(np.sms_enabled, 1) = 1
              OR ? = 'email' AND u.email IS NOT NULL AND COALESCE(np.email_enabled, 1) = 1)
        `)
        .get(job.firmId, job.firmId, job.channel, job.firmId, job.actorId, job.channel, job.channel) as { phone: string; email: string | null } | undefined;
      return row ? { phone: row.phone, email: row.email } : null;
    }
    const row = this.db
      .prepare(`
        SELECT c.phone
        FROM client_accounts c
        JOIN notification_consents nc ON nc.firm_id = ? AND nc.actor_type = 'client'
          AND nc.actor_id = c.id AND nc.channel = ? AND nc.status = 'granted' AND nc.revoked_at IS NULL
        LEFT JOIN notification_preferences np
          ON np.firm_id = ? AND np.actor_type = 'client' AND np.actor_id = c.id
        WHERE c.id = ? AND c.firm_id = ? AND c.status = 'active' AND np.opted_out_at IS NULL
          AND ? = 'sms' AND COALESCE(np.sms_enabled, 1) = 1
      `)
      .get(job.firmId, job.channel, job.firmId, job.actorId, job.firmId, job.channel) as { phone: string } | undefined;
    return row ? { phone: row.phone, email: null } : null;
  }

  recordNotificationAttempt(jobId: string, input: { providerId: string | null; error: string | null }): void {
    const job = this.readNotificationJobs("WHERE id = ?", [jobId])[0];
    if (!job) {
      return;
    }
    const status = input.error ? (job.attemptCount + 1 >= 3 ? "failed" : "retrying") : "sent";
    this.db
      .prepare("UPDATE notification_jobs SET status = ?, attempt_count = attempt_count + 1, last_error = ? WHERE id = ?")
      .run(status, input.error, jobId);
    this.db
      .prepare("INSERT INTO notification_attempts (id, job_id, provider_id, status, error, attempted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), jobId, input.providerId, status, input.error, nowIso());
  }


  private readNotificationJobs(where: SqliteNotificationWhere, values: Array<string | number>): NotificationJobRecord[] {
    return (this.db
      .prepare(`
        SELECT id, firm_id AS firmId, actor_type AS actorType, actor_id AS actorId, channel, template_key AS templateKey,
          template_version AS templateVersion, payload_json AS payloadJson, scheduled_at AS scheduledAt, status,
          attempt_count AS attemptCount, last_error AS lastError
        FROM notification_jobs ${where}
      `)
      .all(...values) as Array<Omit<NotificationJobRecord, "payload"> & { payloadJson: string }>).map((job) => ({
      ...job,
      payload: decodeJson(job.payloadJson, {}),
    }));
  }

  listAuditEvents(session: ProductSession): AuditEvent[] {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          actor_type AS actorType,
          actor_id AS actorId,
          object_type AS objectType,
          object_id AS objectId,
          event_type AS eventType,
          payload_json AS payloadJson,
          created_at AS createdAt
        FROM audit_events
        WHERE firm_id = ?
        ORDER BY created_at DESC
      `)
      .all(session.firmId)
      .map((row) => ({
        ...(row as unknown as AuditEvent),
        payload: decodeJson((row as { payloadJson: string }).payloadJson, {} as Record<string, unknown>),
      })) as AuditEvent[];
  }

  recordApiMutation(session: ProductSession, method: string, route: string, statusCode: number): void {
    if (!session.firmId) {
      return;
    }
    this.createAuditEvent({
      firmId: session.firmId,
      actorType: session.actorType,
      actorId: session.actorId,
      objectType: "api_route",
      objectId: route,
      eventType: "api.mutation",
      payload: { method, statusCode },
    });
  }

  recordSecurityEvent(
    session: ProductSession,
    eventType: string,
    objectType: string,
    objectId: string,
    payload: Record<string, unknown>,
  ): void {
    if (!session.firmId) {
      return;
    }
    this.createAuditEvent({
      firmId: session.firmId,
      actorType: session.actorType,
      actorId: session.actorId,
      objectType,
      objectId,
      eventType,
      payload,
    });
  }


  createPortalLink(
    session: ProductSession,
    matterId: string,
    ttlHours = 24 * 14,
    clientId?: string,
  ): { portalLink: PortalLink; rawToken: string } | null {
    const firmId = this.getMatterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || !this.canAccessMatter(session, matterId, firmId)) {
      return null;
    }
    const membership = this.db
      .prepare(`
        SELECT cm.client_account_id AS clientAccountId
        FROM client_memberships cm
        JOIN client_accounts c ON c.id = cm.client_account_id
        WHERE cm.matter_id = ? AND c.status = 'active' AND (? IS NULL OR c.id = ?)
        ORDER BY cm.created_at ASC
        LIMIT 2
      `)
      .all(matterId, clientId ?? null, clientId ?? null) as Array<{ clientAccountId: string }>;

    if (membership.length !== 1) {
      return null;
    }

    const rawToken = randomUUID().replace(/-/g, "");
    const portalLink: PortalLink = {
      id: randomUUID(),
      matterId,
      clientAccountId: membership[0].clientAccountId,
      createdBy: session.actorId,
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      revokedAt: null,
    };

    this.db
      .prepare(`
        INSERT INTO portal_links (id, matter_id, client_account_id, created_by, token_hash, expires_at, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        portalLink.id,
        portalLink.matterId,
        portalLink.clientAccountId,
        portalLink.createdBy,
        hashValue(rawToken),
        portalLink.expiresAt,
        portalLink.createdAt,
        portalLink.revokedAt,
      );

    const portalUrl = `${process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"}/portal/otp?token=${rawToken}`;
    this.db
      .prepare(`
        INSERT INTO notification_jobs (
          id, firm_id, actor_type, actor_id, channel, template_key, template_version, payload_json, idempotency_key, scheduled_at, status, attempt_count, last_error, created_at
        ) VALUES (?, ?, 'client', ?, 'sms', 'portal_access_token', 1, ?, ?, ?, 'pending', 0, NULL, ?)
      `)
      .run(
        randomUUID(),
        firmId,
        membership[0].clientAccountId,
        JSON.stringify({ matterId, portalUrl }),
        `portal-access:${portalLink.id}:sms`,
        nowIso(),
        portalLink.createdAt,
      );

    return { portalLink, rawToken };
  }

  getPortalAccess(rawToken: string): PortalAccess | null {
    const link = this.db
      .prepare(`
        SELECT
          id,
          matter_id AS matterId,
          client_account_id AS clientAccountId,
          created_by AS createdBy,
          expires_at AS expiresAt,
          created_at AS createdAt,
          revoked_at AS revokedAt
        FROM portal_links
        WHERE token_hash = ? AND revoked_at IS NULL AND expires_at >= ?
      `)
      .get(hashValue(rawToken), nowIso()) as PortalLink | undefined;

    if (!link) {
      return null;
    }

    const clientAccount = this.db
      .prepare("SELECT id, phone, display_name AS displayName, language, status FROM client_accounts WHERE id = ? AND status = 'active'")
      .get(link.clientAccountId) as ClientAccount | undefined;

    if (!clientAccount) {
      return null;
    }

    return {
      link,
      clientAccount,
      session: {
        actorType: "client",
        actorId: clientAccount.id,
        firmId: this.getMatterFirmId(link.matterId),
      },
    };
  }

  listPortalMattersForAccess(rawToken: string, portalLinkId: string): Matter[] {
    const access = this.getPortalAccess(rawToken);
    if (!access || access.link.id !== portalLinkId) {
      return [];
    }
    return this.listMatters(access.session);
  }

  getPortalMatterForAccess(rawToken: string, portalLinkId: string, matterId: string): MatterDetail | null {
    const access = this.getPortalAccess(rawToken);
    if (!access || access.link.id !== portalLinkId) {
      return null;
    }
    const matter = this.getMatter(access.session, matterId);
    return matter ? { ...matter, documents: matter.documents.filter((document) => document.portalVisible) } : null;
  }

  readSeedAsset(storageKey: string): { bytes: Buffer; contentType: string } | null {
    return readLegalSeedAsset(storageKey);
  }
}

export function readLegalSeedAsset(storageKey: string): { bytes: Buffer; contentType: string } | null {
  if (storageKey === "seed:vakalatnama-signed.pdf") {
    return {
      bytes: buildLegalPdf("Vakalatnama Signed", buildDenseLegalPages("vakalatnama", 1)),
      contentType: "application/pdf",
    };
  }
  if (storageKey === "seed:writ-petition-final.pdf") {
    return {
      bytes: buildLegalPdf("W.P. 2076/2019 - Final Writ Petition", buildDenseLegalPages("writ", 6)),
      contentType: "application/pdf",
    };
  }
  if (storageKey === "seed:written-objections-final.docx") {
    return {
      bytes: buildLegalDocx("Written Objections Final", buildDenseLegalPages("writ", 6)),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (storageKey === "seed:evidence-annexures.pdf") {
    return {
      bytes: buildLegalPdf("Evidence Annexures", buildDenseLegalPages("annexures", 4)),
      contentType: "application/pdf",
    };
  }
  if (storageKey === "seed:plaint-property-dispute.pdf") {
    return {
      bytes: buildLegalPdf("Civil Suit 45/2025 - Plaint", buildDenseLegalPages("plaint", 4)),
      contentType: "application/pdf",
    };
  }
  if (storageKey === "seed:hearing-order-april.png") {
    return {
      bytes: readFileSync(new URL("../../../../Wakeel Design System/assets/hearing-order-sample.png", import.meta.url)),
      contentType: "image/png",
    };
  }
  return null;
}

function buildDenseLegalPages(kind: "vakalatnama" | "writ" | "annexures" | "plaint", pageCount: number): string[] {
  const sections: Record<typeof kind, string[]> = {
    vakalatnama: [
      "VAKALATNAMA. I, the authorized representative of Redtone Telecommunications Pak Pvt Ltd, do hereby appoint Advocate Salman Hassan, Advocate High Court, Hassan & Co. Law Associates, Islamabad, to act, appear, plead, compromise, withdraw, inspect record, file applications, receive certified copies, and do all lawful acts in W.P. 2076/2019 pending before the Islamabad High Court.",
      "The attorney is authorized to present written submissions, move urgent applications, receive notices, engage assisting counsel, and take all steps necessary for protection of the petitioner's constitutional and statutory rights in respect of the impugned recovery proceedings initiated by the tax authorities.",
      "This authority includes power to sign pleadings, affidavits, applications, execution papers, objections, rejoinders, miscellaneous applications, and any other document required by the office of the Honourable Court or by law.",
    ],
    writ: [
      "IN THE ISLAMABAD HIGH COURT, ISLAMABAD. Constitutional Petition under Article 199 of the Constitution of the Islamic Republic of Pakistan, 1973. Redtone Telecommunications Pak Pvt Ltd respectfully invokes the constitutional jurisdiction of this Honourable Court against unlawful recovery action, coercive notices, and proceedings undertaken without lawful authority.",
      "The petitioner is a duly incorporated company engaged in telecommunication infrastructure and related services. The respondents have proceeded on assumptions contrary to the record, ignored material correspondence, and failed to decide the petitioner's statutory representations before initiating coercive measures.",
      "The impugned action is without jurisdiction, violative of the principles of natural justice, and liable to be declared as having been taken without lawful authority and of no legal effect. The petitioner has no equally efficacious alternative remedy where the threatened recovery is immediate and the jurisdictional defect is apparent on the face of the record.",
      "GROUNDS. The respondents failed to issue a proper show cause notice; failed to provide complete relied-upon material; acted in excess of statutory powers; disregarded binding departmental instructions; and treated a disputed demand as final despite pending adjudicatory steps.",
      "PRAYER. It is respectfully prayed that this Honourable Court may suspend the impugned recovery proceedings, restrain coercive action, direct the respondents to decide pending representations after affording hearing, and grant any other relief deemed just and proper in the circumstances.",
    ],
    annexures: [
      "ANNEXURE A. Certified copy index of correspondence exchanged between Redtone Telecommunications Pak Pvt Ltd and the Commissioner Inland Revenue. The record reflects repeated requests for reconciliation of demand, supply of relied-upon documents, and withdrawal of coercive recovery notices pending departmental review.",
      "ANNEXURE B. Payment receipt and bank challan summary. Receipt No. IHC-TAX-2076-01 records deposit made under protest. The petitioner reserved all rights and stated that deposit shall not be treated as admission of liability.",
      "ANNEXURE C. Department acknowledgment and postal receipt. The office of the respondent acknowledged receipt of written objections, supporting ledger extracts, and reconciliation statements showing disputed entries.",
      "ANNEXURE D. Internal board authorization. The authorized representative was empowered to institute constitutional proceedings, execute vakalatnama, and coordinate with counsel for urgent relief before the Islamabad High Court.",
    ],
    plaint: [
      "IN THE COURT OF CIVIL JUDGE, RAWALPINDI. Civil Suit 45/2025. Ahmed Zubair versus Property Builders Ltd. Suit for declaration, specific performance, permanent injunction, damages, and any other relief deemed appropriate.",
      "The plaintiff entered into an agreement for purchase of a residential unit and paid substantial consideration through banking instruments and acknowledged receipts. The defendant failed to hand over possession within the promised timeline and attempted to impose additional charges not contemplated by the booking form or payment schedule.",
      "CAUSE OF ACTION. The cause of action first arose when the defendant accepted booking amount and confirmed allotment, again when possession was delayed, and finally when the defendant refused to execute transfer documents despite receipt of repeated notices.",
      "PRAYER. It is respectfully prayed that the defendant be directed to specifically perform the agreement, execute transfer documents, refrain from alienating the unit, pay damages for delay, and bear costs of proceedings.",
    ],
  };

  return Array.from({ length: pageCount }, (_, index) => {
    const heading = `${kind.toUpperCase()} - PAGE ${index + 1} OF ${pageCount}`;
    const body = sections[kind].map((section, sectionIndex) => {
      const clauseNumber = index * sections[kind].length + sectionIndex + 1;
      return `${clauseNumber}. ${section} Supporting facts, office notes, annexure references, dates of correspondence, and counsel's margin annotations are reproduced for demo review. This paragraph is intentionally text-heavy so search, preview, OCR, and document rendering screens feel close to a real litigation file.`;
    });
    return [heading, "", ...body, "", "Verification: The contents are true to the best of the deponent's knowledge and belief. Filed through Advocate Salman Hassan, Hassan & Co. Law Associates, Islamabad."].join("\n");
  });
}

function buildLegalPdf(title: string, pages: string[]): Buffer {
  const fontId = 3;
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 72;
  const textWidth = pageWidth - margin * 2;
  const bodyFontSize = 10;
  const headerFontSize = 13;
  const lineHeight = 14;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const [pageHeading = "", ...paragraphs] = page.split("\n").filter((line) => line.trim().length > 0);
    const bodyLines = paragraphs.flatMap((paragraph) => wrapPdfParagraph(paragraph, textWidth, bodyFontSize)).slice(0, 43);
    let y = pageHeight - margin;
    const streamParts = [
      "BT",
      `/F1 ${headerFontSize} Tf`,
      "0 Tw",
      `${centerPdfTextX(title.toUpperCase(), pageWidth, headerFontSize).toFixed(2)} ${y} Td`,
      `(${escapePdfText(title.toUpperCase())}) Tj`,
      "ET",
    ];

    y -= 24;
    streamParts.push(
      "BT",
      `/F1 ${bodyFontSize} Tf`,
      "0 Tw",
      `${centerPdfTextX(pageHeading, pageWidth, bodyFontSize).toFixed(2)} ${y} Td`,
      `(${escapePdfText(pageHeading)}) Tj`,
      "ET",
    );

    y -= 26;
    streamParts.push("BT", `/F1 ${bodyFontSize} Tf`);
    for (const line of bodyLines) {
      const wordSpacing = line.justify ? justifiedWordSpacing(line.text, textWidth, bodyFontSize) : 0;
      streamParts.push(`${wordSpacing.toFixed(3)} Tw`);
      streamParts.push(`1 0 0 1 ${margin} ${y.toFixed(2)} Tm`);
      streamParts.push(`(${escapePdfText(line.text)}) Tj`);
      y -= lineHeight;
    }
    streamParts.push("0 Tw", "ET");
    const stream = [
      ...streamParts,
    ].join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const startXref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function wrapPdfParagraph(text: string, maxWidth: number, fontSize: number): Array<{ text: string; justify: boolean }> {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimatePdfTextWidth(next, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.map((line, index) => ({ text: line, justify: index < lines.length - 1 && line.includes(" ") }));
}

function centerPdfTextX(text: string, pageWidth: number, fontSize: number): number {
  return Math.max(36, (pageWidth - estimatePdfTextWidth(text, fontSize)) / 2);
}

function justifiedWordSpacing(text: string, targetWidth: number, fontSize: number): number {
  const spaces = text.split(" ").length - 1;
  if (spaces <= 0) {
    return 0;
  }
  const remaining = targetWidth - estimatePdfTextWidth(text, fontSize);
  return remaining > 0 ? remaining / spaces : 0;
}

function estimatePdfTextWidth(text: string, fontSize: number): number {
  return text.split("").reduce((total, char) => {
    if (char === " ") {
      return total + fontSize * 0.28;
    }
    if ("il.,'|".includes(char)) {
      return total + fontSize * 0.24;
    }
    if ("mwMW@#%".includes(char)) {
      return total + fontSize * 0.78;
    }
    if (/[A-Z0-9]/.test(char)) {
      return total + fontSize * 0.56;
    }
    return total + fontSize * 0.48;
  }, 0);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildLegalDocx(title: string, pages: string[]): Buffer {
  const paragraphs = pages.flatMap((page) => page.split("\n").filter((line) => line.trim().length > 0));
  const body = [
    wordParagraph(title.toUpperCase(), "center", true),
    ...paragraphs.map((paragraph, index) => wordParagraph(paragraph, index === 0 ? "center" : "both", index === 0)),
  ].join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  return buildZip([
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      path: "word/document.xml",
      content: documentXml,
    },
  ]);
}

function wordParagraph(text: string, justification: "center" | "both", bold = false): string {
  return `<w:p>
  <w:pPr><w:jc w:val="${justification}"/><w:spacing w:after="160"/></w:pPr>
  <w:r>
    <w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${bold ? 26 : 22}"/></w:rPr>
    <w:t xml:space="preserve">${escapeXmlText(text)}</w:t>
  </w:r>
</w:p>`;
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildZip(files: Array<{ path: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildHearingOrderSvg(): string {
  const lines = [
    "IN THE ISLAMABAD HIGH COURT, ISLAMABAD",
    "W.P. 2076/2019 - Redtone Telecommunications Pak Pvt Ltd v CIR etc",
    "Order Sheet - April Hearing",
    "Present: Advocate Salman Hassan for the petitioner.",
    "Arguments heard at length. Learned counsel referred to the pending",
    "representations, recovery notices, and annexures available on record.",
    "Office is directed to place the connected record with this file.",
    "Order reserved. To be pronounced on the date fixed by the office.",
    "Sd/- Court Associate",
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400">
  <rect width="1000" height="1400" fill="#f7f3e8"/>
  <rect x="70" y="70" width="860" height="1260" fill="#fffdf7" stroke="#9a8f7a" stroke-width="3"/>
  <text x="500" y="145" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#1f2933">${lines[0]}</text>
  ${lines.slice(1).map((line, index) => `<text x="120" y="${240 + index * 88}" font-family="Georgia, serif" font-size="${index === 1 ? 30 : 27}" fill="#2d3748">${line}</text>`).join("\n  ")}
  <line x1="120" y1="1090" x2="880" y2="1090" stroke="#9a8f7a" stroke-width="2"/>
  <text x="120" y="1160" font-family="Georgia, serif" font-size="24" fill="#4a5568">Certified copy prepared for LegalBahi pilot demonstration.</text>
</svg>`;
}


Object.assign(
  ProductStore.prototype,
  coreMethods,
  matterMethods,
  clientMethods,
  hearingMethods,
);

type StripThis<T> = {
  [K in keyof T]: T[K] extends (this: any, ...args: infer A) => infer R
    ? (...args: A) => R
    : T[K];
};

export interface ProductStore extends
  StripThis<TypeOfCoreMethods>,
  StripThis<TypeOfMatterMethods>,
  StripThis<TypeOfClientMethods>,
  StripThis<TypeOfHearingMethods> {}

type TypeOfCoreMethods = typeof coreMethods;
type TypeOfMatterMethods = typeof matterMethods;
type TypeOfClientMethods = typeof clientMethods;
type TypeOfHearingMethods = typeof hearingMethods;

export function createProductStore(dbPath = process.env.WAKEEL_PRODUCT_DB_PATH ?? "data/legalbahi-product.sqlite"): ProductStore {
  const isTesting =
    process.env.NODE_ENV === "test" ||
    process.env.WAKEEL_TESTING === "true" ||
    (process.env.DEMO_DB_PATH ? process.env.DEMO_DB_PATH.includes("wakeel-product-api-") : false) ||
    (process.env.WAKEEL_PRODUCT_DB_PATH ? process.env.WAKEEL_PRODUCT_DB_PATH.includes("wakeel-product-api-") : false);
  const defaultSeed = isTesting || envFlag("ENABLE_PRODUCT_SEED_DATA", false);
  return new ProductStore(dbPath, { seed: defaultSeed });
}
