import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Pool } from "pg";

import { ProductStore } from "./lib/product-store.js";

import { createHash } from "node:crypto";

const SEED_TABLES = [
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
  "time_entries",
  "invoices",
  "court_sources",
  "ingestion_runs",
  "alerts",
  "notification_preferences",
  "notification_templates",
  "notification_consents",
  "notification_jobs",
  "pilot_invites",
] as const;

const UUID_COLUMNS = new Set([
  "id",
  "firm_id",
  "user_id",
  "lead_lawyer_id",
  "client_account_id",
  "matter_id",
  "document_id",
  "thread_id",
  "sender_id",
  "contact_ref",
  "cause_list_entry_id",
  "job_id",
  "actor_id",
  "uploaded_by",
  "created_by",
]);

const COLUMN_MAP: Record<string, string> = {
  permissions_json: "permissions",
  metrics_json: "metrics",
  payload_json: "payload",
};

function toDeterministicUuid(value: unknown): string | unknown {
  if (value == null || value === "") {
    return value;
  }
  const text = String(value);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return text;
  }
  const hash = createHash("md5").update(text).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function mapDocumentType(value: unknown): string {
  const normalized = String(value || "").toLowerCase();
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

function mapPartyType(value: unknown): string {
  const str = String(value || "").toLowerCase();
  if (str === "plaintiff") return "petitioner";
  if (str === "defendant") return "respondent";
  return str;
}

async function copyTable(sqlite: DatabaseSync, pool: Pool, table: string): Promise<number> {
  // Check if table exists in Postgres
  const tableCheck = await pool.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
    [table]
  );
  if (!tableCheck.rows[0]?.exists) {
    return 0;
  }

  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.length === 0) {
    return 0;
  }
  const sqliteNames = columns.map((column) => column.name);
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return 0;
  }

  const pgNames = sqliteNames.map((name) => COLUMN_MAP[name] ?? name);
  let inserted = 0;
  const placeholders = pgNames.map((_, index) => `$${index + 1}`).join(", ");
  for (const row of rows) {
    const values = sqliteNames.map((name) => {
      let val = row[name];
      if (UUID_COLUMNS.has(name)) {
        if (!(table === "court_sources" && name === "id")) {
          val = toDeterministicUuid(val);
        }
      }
      if (table === "documents" && name === "type") {
        val = mapDocumentType(val);
      }
      if (table === "matter_parties" && name === "party_type") {
        val = mapPartyType(val);
      }
      return val;
    });

    try {
      const result = await pool.query(
        `INSERT INTO ${table} (${pgNames.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
      inserted += result.rowCount ?? 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipped ${table} row (${message})`);
    }
  }
  return inserted;
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const existing = await pool.query("SELECT COUNT(*)::int AS count FROM firms");
    const firmCount = existing.rows[0]?.count ?? 0;
    if (firmCount > 0) {
      console.log(`Postgres already has ${firmCount} firm(s); investor seed skipped.`);
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-investor-seed-"));
    const sqlitePath = join(tempDir, "seed.sqlite");
    try {
      new ProductStore(sqlitePath, { seed: true });
      const sqlite = new DatabaseSync(sqlitePath);

      console.log("Copying investor demo data from seeded SQLite snapshot into Postgres...");
      for (const table of SEED_TABLES) {
        const count = await copyTable(sqlite, pool, table);
        if (count > 0) {
          console.log(`  ${table}: ${count} row(s)`);
        }
      }
      console.log("Investor Postgres seed complete.");
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep the SQLite file locked briefly after the store closes.
      }
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
