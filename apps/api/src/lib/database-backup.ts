import { spawn } from "node:child_process";
import { basename } from "node:path";

import { shouldUsePostgresProductStore } from "./runtime-product-store.js";
import {
  backupEnabled,
  defaultSqliteBackupPath,
  readSqliteDatabaseBytes,
  uploadDatabaseBackupArchive,
} from "./backup-storage.js";

let lastBackupAt = 0;

function backupIntervalMs(): number {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24);
  if (!Number.isFinite(hours) || hours <= 0) {
    return 24 * 60 * 60 * 1000;
  }
  return hours * 60 * 60 * 1000;
}

async function runPgDump(databaseUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", ["--format=custom", "--no-owner", databaseUrl], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump failed: ${Buffer.concat(errors).toString("utf8") || `exit ${code}`}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function runScheduledDatabaseBackup(force = false): Promise<{ ran: boolean; storageKey?: string }> {
  if (!backupEnabled()) {
    return { ran: false };
  }
  const now = Date.now();
  if (!force && now - lastBackupAt < backupIntervalMs()) {
    return { ran: false };
  }

  let archiveName = "legalbahi";
  let bytes: Buffer;
  if (shouldUsePostgresProductStore()) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for PostgreSQL backups");
    }
    archiveName = "postgres";
    bytes = await runPgDump(databaseUrl);
  } else {
    const dbPath = defaultSqliteBackupPath();
    archiveName = basename(dbPath).replace(/\.sqlite$/i, "") || "sqlite";
    bytes = readSqliteDatabaseBytes(dbPath);
  }

  const uploaded = await uploadDatabaseBackupArchive({ archiveName, bytes });
  lastBackupAt = now;
  return { ran: true, storageKey: uploaded.storageKey };
}

export function resetBackupScheduleForTests(): void {
  lastBackupAt = 0;
}
