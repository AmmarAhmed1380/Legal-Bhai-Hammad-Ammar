import { existsSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";
import { DatabaseSync } from "node:sqlite";

import { envFlag } from "./lib/config.js";
import { readLegalSeedAsset } from "./lib/product-store.js";
import { createPrivateObjectStorage } from "./lib/storage.js";

interface SeedDocumentRow {
  id: string;
  title: string;
  storage_key: string;
  mime_type: string | null;
}

async function migrateSeedDocuments(
  seedDocs: SeedDocumentRow[],
  updateStorageKey: (id: string, storageKey: string) => Promise<void>,
): Promise<void> {
  if (seedDocs.length === 0) {
    console.log("No seed documents require migration. Done.");
    return;
  }

  console.log("Initializing R2 storage...");
  const r2Storage = createPrivateObjectStorage();

  for (const doc of seedDocs) {
    console.log(`Migrating '${doc.title}' (${doc.storage_key})...`);
    const seedAsset = readLegalSeedAsset(doc.storage_key);
    if (!seedAsset) {
      console.warn(`Warning: Could not read seed asset data for key '${doc.storage_key}'. Skipping.`);
      continue;
    }

    try {
      const newStorageKey = await r2Storage.put({
        fileName: doc.title,
        bytes: seedAsset.bytes,
        contentType: doc.mime_type || seedAsset.contentType,
      });
      console.log(`Successfully uploaded. New R2 storage key: ${newStorageKey}`);
      await updateStorageKey(doc.id, newStorageKey);
      console.log(`Updated document record id '${doc.id}' to storage key '${newStorageKey}'.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Failed to migrate '${doc.title}': ${message}`);
    }
  }
}

async function runMigration(): Promise<void> {
  console.log("Starting document R2 migration...");

  const usePostgres = envFlag("USE_POSTGRES_PRODUCT_STORE") || Boolean(process.env.DATABASE_URL?.startsWith("postgres"));
  if (usePostgres) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for Postgres seed document migration");
    }
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const result = await pool.query(
        "SELECT id, title, storage_key, mime_type FROM documents WHERE storage_key LIKE 'seed:%'",
      );
      const seedDocs = result.rows as SeedDocumentRow[];
      console.log(`Found ${seedDocs.length} seed document(s) to migrate to R2.`);
      await migrateSeedDocuments(seedDocs, async (id, storageKey) => {
        await pool.query("UPDATE documents SET storage_key = $1 WHERE id = $2", [storageKey, id]);
      });
    } finally {
      await pool.end();
    }
    console.log("Migration completed successfully.");
    return;
  }

  let dbPath = join(process.cwd(), "data", "legalbahi-product.sqlite");
  if (!existsSync(dbPath)) {
    dbPath = join(process.cwd(), "apps", "api", "data", "legalbahi-product.sqlite");
  }
  if (!existsSync(dbPath)) {
    throw new Error("Could not locate legalbahi-product.sqlite database file");
  }

  console.log("Connecting to database:", dbPath);
  const db = new DatabaseSync(dbPath);
  const seedDocs = db.prepare(
    "SELECT id, title, storage_key, mime_type FROM documents WHERE storage_key LIKE 'seed:%'",
  ).all() as SeedDocumentRow[];
  console.log(`Found ${seedDocs.length} seed document(s) to migrate to R2.`);
  await migrateSeedDocuments(seedDocs, async (id, storageKey) => {
    db.prepare("UPDATE documents SET storage_key = ? WHERE id = ?").run(storageKey, id);
  });
  console.log("Migration completed successfully.");
}

runMigration().catch((error) => {
  console.error("Fatal migration error:", error);
  process.exit(1);
});
