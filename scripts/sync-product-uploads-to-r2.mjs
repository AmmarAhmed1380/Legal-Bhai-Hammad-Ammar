import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const uploadsDirectory = process.env.PRODUCT_UPLOADS_DIRECTORY
  ?? join(repoRoot, "apps", "api", "data", "product-uploads");

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_DOCUMENT_BUCKET ?? process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_DOCUMENT_BUCKET.");
  process.exit(1);
}

if (!existsSync(uploadsDirectory)) {
  console.log(`No local uploads directory at ${uploadsDirectory}; nothing to sync.`);
  process.exit(0);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function walkFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

const files = walkFiles(uploadsDirectory);
if (files.length === 0) {
  console.log(`No files found under ${uploadsDirectory}.`);
  process.exit(0);
}

console.log(`Uploading ${files.length} file(s) from ${uploadsDirectory} to R2 bucket ${bucket}...`);

for (const filePath of files) {
  const key = filePath.slice(uploadsDirectory.length + 1).replace(/\\/g, "/");
  const size = statSync(filePath).size;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: size,
  }));
  console.log(`  uploaded ${key}`);
}

console.log("R2 upload sync complete.");
