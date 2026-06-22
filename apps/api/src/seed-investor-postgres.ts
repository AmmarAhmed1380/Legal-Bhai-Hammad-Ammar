import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Pool } from "pg";

import { ProductStore } from "./lib/product-store.js";

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

async function copyTable(sqlite: DatabaseSync, pool: Pool, table: string): Promise<number> {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.length === 0) {
    return 0;
  }
  const names = columns.map((column) => column.name);
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return 0;
  }

  let inserted = 0;
  const placeholders = names.map((_, index) => `$${index + 1}`).join(", ");
  for (const row of rows) {
    const values = names.map((name) => row[name]);
    try {
      const result = await pool.query(
        `INSERT INTO ${table} (${names.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
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
