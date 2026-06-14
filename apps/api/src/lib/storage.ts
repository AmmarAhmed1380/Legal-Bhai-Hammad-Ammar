import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { isProduction } from "./config.js";

export interface PrivateObjectStorage {
  put(input: { fileName: string; bytes: Buffer; contentType: string }): Promise<string>;
  read(storageKey: string): { bytes: Buffer; contentType: string | null } | null;
  signedDownloadUrl(storageKey: string): Promise<string | null>;
}

class LocalPrivateObjectStorage implements PrivateObjectStorage {
  private readonly directory = process.env.PRODUCT_UPLOADS_DIRECTORY ?? join(process.cwd(), "data", "product-uploads");

  async put(input: { fileName: string; bytes: Buffer; contentType: string }): Promise<string> {
    mkdirSync(this.directory, { recursive: true });
    const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}${extname(input.fileName) || ".bin"}`;
    writeFileSync(join(this.directory, fileName), input.bytes);
    return `local:${fileName}:${encodeURIComponent(input.contentType)}`;
  }

  read(storageKey: string): { bytes: Buffer; contentType: string | null } | null {
    if (!storageKey.startsWith("local:")) {
      return null;
    }
    const [, fileName, encodedContentType] = storageKey.split(":");
    return { bytes: readFileSync(join(this.directory, fileName)), contentType: decodeURIComponent(encodedContentType || "") || null };
  }

  async signedDownloadUrl(): Promise<string | null> {
    return null;
  }
}

class R2PrivateObjectStorage implements PrivateObjectStorage {
  private readonly bucket = process.env.R2_DOCUMENT_BUCKET!;
  private readonly client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  async put(input: { fileName: string; bytes: Buffer; contentType: string }): Promise<string> {
    const key = `private/documents/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extname(input.fileName) || ".bin"}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.bytes, ContentType: input.contentType }));
    return `r2:${key}`;
  }

  read(): null {
    return null;
  }

  async signedDownloadUrl(storageKey: string): Promise<string | null> {
    if (!storageKey.startsWith("r2:")) {
      return null;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: storageKey.slice(3) }), { expiresIn: 300 });
  }
}

export function createPrivateObjectStorage(): PrivateObjectStorage {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_DOCUMENT_BUCKET
  ) {
    return new R2PrivateObjectStorage();
  }
  if (isProduction()) {
    throw new Error("Cloudflare R2 document storage must be configured in production");
  }
  return new LocalPrivateObjectStorage();
}
