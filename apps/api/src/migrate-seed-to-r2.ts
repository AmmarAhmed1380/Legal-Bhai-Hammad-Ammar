import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createPrivateObjectStorage } from "./lib/storage.js";
import { readLegalSeedAsset } from "./lib/product-store.js";

async function runMigration() {
  console.log("Starting document R2 migration...");

  // Detect SQLite database path
  let dbPath = join(process.cwd(), "data", "legalbahi-product.sqlite");
  if (!existsSync(dbPath)) {
    dbPath = join(process.cwd(), "apps", "api", "data", "legalbahi-product.sqlite");
  }
  if (!existsSync(dbPath)) {
    console.error("Error: Could not locate legalbahi-product.sqlite database file!");
    process.exit(1);
  }

  console.log("Connecting to database:", dbPath);
  const db = new DatabaseSync(dbPath);

  // 1. Delete client-uploaded document (added from user side)
  console.log("Deleting client-uploaded documents...");
  const deleteResult = db.prepare("DELETE FROM documents WHERE uploaded_by LIKE 'client-%' OR id = '5c481fbc-ea1d-4da3-938d-86477ddef2f8'").run();
  console.log(`Deleted ${deleteResult.changes} client-uploaded document(s).`);

  // 2. Fetch seed documents to migrate to R2
  const seedDocs = db.prepare("SELECT id, title, storage_key, mime_type FROM documents WHERE storage_key LIKE 'seed:%'").all() as any[];
  console.log(`Found ${seedDocs.length} seed document(s) to migrate to R2.`);

  if (seedDocs.length === 0) {
    console.log("No seed documents require migration. Done.");
    return;
  }

  // 3. Initialize R2 storage
  console.log("Initializing R2 storage...");
  const r2Storage = createPrivateObjectStorage();

  // 4. Upload each seed document to R2 and update storage key in DB
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
        contentType: doc.mimeType || seedAsset.contentType,
      });

      console.log(`Successfully uploaded. New R2 storage key: ${newStorageKey}`);

      // Update in DB
      const updateResult = db.prepare("UPDATE documents SET storage_key = ? WHERE id = ?").run(newStorageKey, doc.id);
      if (updateResult.changes > 0) {
        console.log(`Updated document record id '${doc.id}' to storage key '${newStorageKey}' in DB.`);
      } else {
        console.error(`Error: Failed to update document record id '${doc.id}' in DB.`);
      }
    } catch (err: any) {
      console.error(`Error: Failed to migrate '${doc.title}':`, err.message);
    }
  }

  console.log("Migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
