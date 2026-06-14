import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const migrationsDirectory = resolve(process.cwd(), "../../infra/postgres/migrations");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, "");
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (existing.rowCount === 1) {
      continue;
    }
    await pool.query(await readFile(resolve(migrationsDirectory, file), "utf8"));
    await pool.query("INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING", [version]);
    process.stdout.write(`Applied ${version}\n`);
  }
} finally {
  await pool.end();
}
