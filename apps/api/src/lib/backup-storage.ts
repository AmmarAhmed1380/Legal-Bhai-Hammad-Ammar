import { createGzip } from "node:zlib";
import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { envFlag, isProduction } from "./config.js";

function backupClientConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BACKUP_BUCKET &&
      (process.env.R2_BACKUP_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID) &&
      (process.env.R2_BACKUP_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY),
  );
}

function createBackupClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_BACKUP_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_BACKUP_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function gzipBuffer(input: Buffer): Promise<Buffer> {
  const source = Readable.from(input);
  const gzip = createGzip({ level: 9 });
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await pipeline(source, gzip, sink);
  return Buffer.concat(chunks);
}

export async function uploadDatabaseBackupArchive(input: {
  archiveName: string;
  bytes: Buffer;
}): Promise<{ storageKey: string; compressedBytes: number }> {
  const compressed = await gzipBuffer(input.bytes);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storageKey = `database/${timestamp}-${input.archiveName}.gz`;

  if (!backupClientConfigured()) {
    if (isProduction()) {
      throw new Error("R2 backup bucket credentials must be configured in production");
    }
    console.error("[backup] skipped R2 upload (backup credentials not configured)", {
      storageKey,
      compressedBytes: compressed.length,
    });
    return { storageKey: `local:${storageKey}`, compressedBytes: compressed.length };
  }

  const client = createBackupClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BACKUP_BUCKET!,
      Key: storageKey,
      Body: compressed,
      ContentType: "application/gzip",
    }),
  );
  console.error("[backup] uploaded archive", {
    bucket: process.env.R2_BACKUP_BUCKET,
    storageKey,
    compressedBytes: compressed.length,
  });
  return { storageKey, compressedBytes: compressed.length };
}

export function readSqliteDatabaseBytes(dbPath: string): Buffer {
  return readFileSync(dbPath);
}

export function defaultSqliteBackupPath(): string {
  return process.env.WAKEEL_PRODUCT_DB_PATH ?? "data/legalbahi-product.sqlite";
}

export function backupEnabled(): boolean {
  if (envFlag("BACKUP_ENABLED", true) === false) {
    return false;
  }
  return isProduction() || backupClientConfigured() || Boolean(process.env.WAKEEL_PRODUCT_DB_PATH);
}
