#!/usr/bin/env node
/**
 * Converts apps/api/data/migration_data.sql (SQLite dump) into PostgreSQL-compatible
 * data INSERTs for import after `npm run migrate`.
 *
 * Usage:
 *   node scripts/convert-sqlite-dump-to-postgres.mjs
 *   node scripts/convert-sqlite-dump-to-postgres.mjs [input.sql] [output.sql]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v5 as uuidv5 } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultInput = resolve(repoRoot, "apps/api/data/migration_data.sql");
const defaultOutput = resolve(repoRoot, "apps/api/data/migration_data.postgres.sql");

const SEED_NAMESPACE = "f3a2c8e1-9b4d-4e6f-a1c2-3d4e5f607182";

/** Tables present in Postgres migrations (data import). */
const PG_TABLES = new Set([
  "firms",
  "product_users",
  "firm_memberships",
  "client_accounts",
  "matters",
  "matter_parties",
  "client_memberships",
  "message_threads",
  "messages",
  "documents",
  "document_links",
  "hearings",
  "calendar_items",
  "court_sources",
  "ingestion_runs",
  "alerts",
  "audit_events",
  "notification_preferences",
  "notification_templates",
  "notification_consents",
]);

/** Import order respecting foreign keys. */
const TABLE_ORDER = [
  "firms",
  "product_users",
  "firm_memberships",
  "client_accounts",
  "matters",
  "matter_parties",
  "client_memberships",
  "court_sources",
  "message_threads",
  "messages",
  "documents",
  "document_links",
  "hearings",
  "calendar_items",
  "ingestion_runs",
  "alerts",
  "audit_events",
  "notification_preferences",
  "notification_templates",
  "notification_consents",
];

const SQLITE_COLUMNS = {
  firms: ["id", "name", "primary_city", "billing_plan", "timezone", "status", "created_at"],
  product_users: ["id", "phone", "email", "display_name", "language", "status", "created_at"],
  firm_memberships: ["id", "firm_id", "user_id", "role", "permissions_json", "office_label", "created_at"],
  client_accounts: ["id", "phone", "display_name", "language", "status", "created_at", "firm_id"],
  matters: [
    "id", "firm_id", "court_id", "raw_case_number", "normalized_case_number", "title",
    "matter_type", "stage", "status", "next_hearing_at", "lead_lawyer_id", "created_at", "updated_at",
  ],
  matter_parties: ["id", "matter_id", "party_type", "display_name", "contact_ref", "created_at"],
  client_memberships: ["id", "client_account_id", "matter_id", "access_level", "created_at"],
  court_sources: [
    "id", "court_id", "source_type", "ingestion_mode", "status",
    "last_successful_sync_at", "metrics_json", "created_at",
  ],
  message_threads: ["id", "matter_id", "participant_type", "status", "created_at"],
  messages: [
    "id", "thread_id", "sender_type", "sender_id", "body", "language",
    "delivery_channel", "delivery_state", "created_at",
  ],
  documents: [
    "id", "firm_id", "matter_id", "folder_id", "type", "title", "storage_key", "mime_type",
    "uploaded_by", "ocr_status", "ocr_text", "search_text", "portal_visible", "created_at",
  ],
  document_links: ["id", "document_id", "matter_id", "created_at"],
  hearings: [
    "id", "matter_id", "listed_at", "outcome", "notes", "next_date", "courtroom",
    "bench", "source_type", "document_id", "created_at",
  ],
  calendar_items: [
    "id", "matter_id", "listed_at", "courtroom", "bench", "source_type",
    "source_confidence", "conflict_state", "created_at",
  ],
  ingestion_runs: [
    "id", "court_source_id", "court_id", "status", "rows_fetched", "rows_parsed",
    "rows_matched", "parser_failures", "unmatched_count", "note", "started_at",
    "finished_at", "created_at",
  ],
  alerts: ["id", "firm_id", "type", "title", "body", "created_at", "read_at"],
  audit_events: [
    "id", "firm_id", "actor_type", "actor_id", "object_type", "object_id",
    "event_type", "payload_json", "created_at",
  ],
  notification_preferences: [
    "id", "firm_id", "actor_type", "actor_id", "email_enabled", "sms_enabled",
    "opted_out_at", "updated_at",
  ],
  notification_templates: [
    "template_key", "channel", "version", "subject_template", "body_template", "enabled", "created_at",
  ],
  notification_consents: [
    "id", "firm_id", "actor_type", "actor_id", "channel", "status", "source",
    "granted_at", "revoked_at", "updated_at",
  ],
};

function seedUuid(value) {
  if (value == null || value === "NULL") {
    return null;
  }
  const text = String(value);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return text;
  }
  return uuidv5(text, SEED_NAMESPACE);
}

function sqlLiteral(value) {
  if (value === null) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlEscapedText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

function sqlTimestamp(value) {
  if (value == null) {
    return "NULL";
  }
  return `${sqlLiteral(value)}::timestamptz`;
}

function sqlDate(value) {
  if (value == null) {
    return "NULL";
  }
  return `${sqlLiteral(value)}::date`;
}

function mapDocumentType(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("hearing") || normalized.includes("court notice")) {
    return "hearing_order";
  }
  if (normalized.includes("evidence")) {
    return "evidence";
  }
  if (normalized.includes("pleading") || normalized.includes("plaint")) {
    return "pleading";
  }
  if (normalized.includes("invoice")) {
    return "invoice";
  }
  if (normalized.includes("note")) {
    return "note";
  }
  return "general";
}

function mapPartyType(value) {
  switch (value) {
    case "plaintiff":
      return "petitioner";
    case "defendant":
      return "respondent";
    default:
      return value;
  }
}

function parseSqliteValues(raw) {
  const values = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (ch === "'" && raw[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      if (ch === "'") {
        inString = false;
        current += ch;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ",") {
      values.push(parseValueToken(current.trim()));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    values.push(parseValueToken(current.trim()));
  }
  return values;
}

function parseValueToken(token) {
  if (token === "NULL") {
    return null;
  }
  if (token.startsWith("'") && token.endsWith("'")) {
    return token.slice(1, -1).replace(/''/g, "'");
  }
  const asNumber = Number(token);
  if (!Number.isNaN(asNumber) && token !== "") {
    return asNumber;
  }
  return token;
}

function extractInserts(sql) {
  const inserts = [];
  const pattern = /INSERT INTO "([^"]+)" VALUES \(([\s\S]*?)\);/g;
  let match = pattern.exec(sql);
  while (match) {
    inserts.push({ table: match[1], values: parseSqliteValues(match[2]) });
    match = pattern.exec(sql);
  }
  return inserts;
}

function rowToObject(table, values) {
  const columns = SQLITE_COLUMNS[table];
  if (!columns) {
    return null;
  }
  const row = {};
  for (let i = 0; i < columns.length; i += 1) {
    row[columns[i]] = values[i];
  }
  return row;
}

function mapId(value, { asText = false } = {}) {
  if (value == null) {
    return null;
  }
  if (asText) {
    return value;
  }
  return seedUuid(value);
}

function buildInsert(table, row) {
  switch (table) {
    case "firms":
      return `INSERT INTO firms (id, name, primary_city, billing_plan, timezone, status, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(row.name),
        sqlLiteral(row.primary_city),
        sqlLiteral(row.billing_plan),
        sqlLiteral(row.timezone),
        sqlLiteral(row.status),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "product_users":
      return `INSERT INTO product_users (id, phone, email, display_name, language, status, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(row.phone),
        row.email == null ? "NULL" : sqlLiteral(row.email),
        sqlLiteral(row.display_name),
        sqlLiteral(row.language),
        sqlLiteral(row.status),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "firm_memberships":
      return `INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions, office_label, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(mapId(row.user_id)),
        sqlLiteral(row.role),
        `${sqlLiteral(row.permissions_json)}::jsonb`,
        row.office_label == null ? "NULL" : sqlLiteral(row.office_label),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "client_accounts":
      return `INSERT INTO client_accounts (id, firm_id, phone, display_name, language, status, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.phone),
        sqlLiteral(row.display_name),
        sqlLiteral(row.language),
        sqlLiteral(row.status),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "matters":
      return `INSERT INTO matters (id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id, created_at, updated_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.court_id),
        sqlLiteral(row.raw_case_number),
        sqlLiteral(row.normalized_case_number),
        sqlLiteral(row.title),
        sqlLiteral(row.matter_type),
        sqlLiteral(row.stage),
        sqlLiteral(row.status),
        row.next_hearing_at == null ? "NULL" : sqlTimestamp(row.next_hearing_at),
        row.lead_lawyer_id == null ? "NULL" : sqlLiteral(mapId(row.lead_lawyer_id)),
        sqlTimestamp(row.created_at),
        sqlTimestamp(row.updated_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "matter_parties":
      return `INSERT INTO matter_parties (id, matter_id, party_type, display_name, contact_ref, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlLiteral(mapPartyType(row.party_type)),
        sqlLiteral(row.display_name),
        row.contact_ref == null ? "NULL" : sqlLiteral(mapId(row.contact_ref)),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "client_memberships":
      return `INSERT INTO client_memberships (id, client_account_id, matter_id, access_level, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.client_account_id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlLiteral(row.access_level),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "court_sources":
      return `INSERT INTO court_sources (id, court_id, source_type, ingestion_mode, status, last_successful_sync_at, metrics, created_at) VALUES (${[
        sqlLiteral(row.id),
        sqlLiteral(row.court_id),
        sqlLiteral(row.source_type),
        sqlLiteral(row.ingestion_mode),
        sqlLiteral(row.status),
        row.last_successful_sync_at == null ? "NULL" : sqlTimestamp(row.last_successful_sync_at),
        `${sqlLiteral(row.metrics_json)}::jsonb`,
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO UPDATE SET
        court_id = EXCLUDED.court_id,
        source_type = EXCLUDED.source_type,
        ingestion_mode = EXCLUDED.ingestion_mode,
        status = EXCLUDED.status,
        last_successful_sync_at = EXCLUDED.last_successful_sync_at,
        metrics = EXCLUDED.metrics,
        created_at = EXCLUDED.created_at;`;

    case "message_threads":
      return `INSERT INTO message_threads (id, matter_id, participant_type, status, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlLiteral(row.participant_type),
        sqlLiteral(row.status),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "messages":
      return `INSERT INTO messages (id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.thread_id)),
        sqlLiteral(row.sender_type),
        sqlLiteral(mapId(row.sender_id)),
        sqlLiteral(row.body),
        sqlLiteral(row.language),
        sqlLiteral(row.delivery_channel),
        sqlLiteral(row.delivery_state),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "documents":
      return `INSERT INTO documents (id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        row.matter_id == null ? "NULL" : sqlLiteral(mapId(row.matter_id)),
        row.folder_id == null ? "NULL" : sqlLiteral(row.folder_id),
        sqlLiteral(mapDocumentType(row.type)),
        sqlLiteral(row.title),
        sqlLiteral(row.storage_key),
        sqlLiteral(row.mime_type),
        sqlLiteral(mapId(row.uploaded_by)),
        sqlLiteral(row.ocr_status),
        row.ocr_text == null ? "NULL" : sqlLiteral(row.ocr_text),
        row.search_text == null ? "NULL" : sqlLiteral(row.search_text),
        row.portal_visible ? "true" : "false",
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "document_links":
      return `INSERT INTO document_links (id, document_id, matter_id, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.document_id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "hearings":
      return `INSERT INTO hearings (id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlTimestamp(row.listed_at),
        sqlLiteral(row.outcome),
        sqlLiteral(row.notes),
        row.next_date == null ? "NULL" : sqlDate(row.next_date),
        row.courtroom == null ? "NULL" : sqlLiteral(row.courtroom),
        row.bench == null ? "NULL" : sqlLiteral(row.bench),
        sqlLiteral(row.source_type),
        row.document_id == null ? "NULL" : sqlLiteral(mapId(row.document_id)),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "calendar_items":
      return `INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.matter_id)),
        sqlTimestamp(row.listed_at),
        row.courtroom == null ? "NULL" : sqlLiteral(row.courtroom),
        row.bench == null ? "NULL" : sqlLiteral(row.bench),
        sqlLiteral(row.source_type),
        String(row.source_confidence),
        sqlLiteral(row.conflict_state),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "ingestion_runs":
      return `INSERT INTO ingestion_runs (id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures, unmatched_count, note, started_at, finished_at, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(row.court_source_id),
        sqlLiteral(row.court_id),
        sqlLiteral(row.status),
        String(row.rows_fetched),
        String(row.rows_parsed),
        String(row.rows_matched),
        String(row.parser_failures),
        String(row.unmatched_count),
        row.note == null ? "NULL" : sqlLiteral(row.note),
        sqlTimestamp(row.started_at),
        sqlTimestamp(row.finished_at),
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "alerts":
      return `INSERT INTO alerts (id, firm_id, type, title, body, created_at, read_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.type),
        sqlLiteral(row.title),
        sqlLiteral(row.body),
        sqlTimestamp(row.created_at),
        row.read_at == null ? "NULL" : sqlTimestamp(row.read_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "audit_events":
      return `INSERT INTO audit_events (id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload, created_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.actor_type),
        row.actor_id == null ? "NULL" : sqlLiteral(mapId(row.actor_id)),
        sqlLiteral(row.object_type),
        sqlLiteral(row.object_id),
        sqlLiteral(row.event_type),
        `${sqlLiteral(row.payload_json)}::jsonb`,
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "notification_preferences":
      return `INSERT INTO notification_preferences (id, firm_id, actor_type, actor_id, email_enabled, sms_enabled, opted_out_at, updated_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.actor_type),
        sqlLiteral(mapId(row.actor_id)),
        row.email_enabled ? "true" : "false",
        row.sms_enabled ? "true" : "false",
        row.opted_out_at == null ? "NULL" : sqlTimestamp(row.opted_out_at),
        sqlTimestamp(row.updated_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    case "notification_templates":
      return `INSERT INTO notification_templates (template_key, channel, version, subject_template, body_template, enabled, created_at) VALUES (${[
        sqlLiteral(row.template_key),
        sqlLiteral(row.channel),
        String(row.version),
        sqlLiteral(row.subject_template),
        `E'${sqlEscapedText(row.body_template)}'`,
        row.enabled ? "true" : "false",
        sqlTimestamp(row.created_at),
      ].join(", ")}) ON CONFLICT (template_key, channel, version) DO NOTHING;`;

    case "notification_consents":
      return `INSERT INTO notification_consents (id, firm_id, actor_type, actor_id, channel, status, source, granted_at, revoked_at, updated_at) VALUES (${[
        sqlLiteral(mapId(row.id)),
        sqlLiteral(mapId(row.firm_id)),
        sqlLiteral(row.actor_type),
        sqlLiteral(mapId(row.actor_id)),
        sqlLiteral(row.channel),
        sqlLiteral(row.status),
        sqlLiteral(row.source),
        row.granted_at == null ? "NULL" : sqlTimestamp(row.granted_at),
        row.revoked_at == null ? "NULL" : sqlTimestamp(row.revoked_at),
        sqlTimestamp(row.updated_at),
      ].join(", ")}) ON CONFLICT (id) DO NOTHING;`;

    default:
      return null;
  }
}

function convert(inputPath, outputPath) {
  const sql = readFileSync(inputPath, "utf8");
  const inserts = extractInserts(sql);
  const grouped = new Map();
  for (const insert of inserts) {
    if (!PG_TABLES.has(insert.table)) {
      continue;
    }
    if (!grouped.has(insert.table)) {
      grouped.set(insert.table, []);
    }
    grouped.get(insert.table).push(insert);
  }

  const lines = [
    "-- PostgreSQL data import generated from SQLite dump",
    "-- Run AFTER: npm run migrate (infra/postgres/migrations)",
    "-- Skips: time_entries, invoices (not in Postgres schema yet)",
    "-- Demo string IDs (firm-hassan-co, staff-owner, ...) map to deterministic UUIDs.",
    "BEGIN;",
    "SET LOCAL session_replication_role = replica;",
    "",
  ];

  let statementCount = 0;
  for (const table of TABLE_ORDER) {
    const tableInserts = grouped.get(table) ?? [];
    if (tableInserts.length === 0) {
      continue;
    }
    lines.push(`-- ${table}`);
    for (const insert of tableInserts) {
      const row = rowToObject(table, insert.values);
      if (!row) {
        continue;
      }
      const statement = buildInsert(table, row);
      if (statement) {
        lines.push(statement);
        statementCount += 1;
      }
    }
    lines.push("");
  }

  lines.push("SET LOCAL session_replication_role = DEFAULT;");
  lines.push("COMMIT;");
  lines.push("");

  writeFileSync(outputPath, lines.join("\n"), "utf8");
  process.stdout.write(`Wrote ${statementCount} INSERT statement(s) to ${outputPath}\n`);
}

const inputPath = resolve(process.argv[2] ?? defaultInput);
const outputPath = resolve(process.argv[3] ?? defaultOutput);
convert(inputPath, outputPath);
