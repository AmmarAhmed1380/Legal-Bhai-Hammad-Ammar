import assert from "node:assert/strict";
import test from "node:test";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { createPrivateObjectStorage } from "../src/lib/storage.js";

test("R2 storage uses private random keys and five-minute signed downloads", async () => {
  const previous = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_DOCUMENT_BUCKET: process.env.R2_DOCUMENT_BUCKET,
  };
  const originalSend = S3Client.prototype.send;
  const putInputs: PutObjectCommand["input"][] = [];

  try {
    process.env.R2_ACCOUNT_ID = "account-test";
    process.env.R2_ACCESS_KEY_ID = "access-test";
    process.env.R2_SECRET_ACCESS_KEY = "secret-test";
    process.env.R2_DOCUMENT_BUCKET = "legalbahi-private-documents";

    S3Client.prototype.send = (async (command: unknown) => {
      assert.ok(command instanceof PutObjectCommand);
      putInputs.push(command.input);
      return {};
    }) as typeof originalSend;

    const storage = createPrivateObjectStorage();
    const storageKey = await storage.put({
      fileName: "hearing-order.pdf",
      bytes: Buffer.from("private hearing order"),
      contentType: "application/pdf",
    });

    assert.match(storageKey, /^r2:private\/documents\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.pdf$/);
    const [putInput] = putInputs;
    assert.ok(putInput);
    assert.equal(putInput.Bucket, "legalbahi-private-documents");
    assert.equal(putInput.Key, storageKey.slice(3));
    assert.equal(putInput.ContentType, "application/pdf");

    const signedUrl = await storage.signedDownloadUrl(storageKey);
    assert.ok(signedUrl);
    const parsed = new URL(signedUrl);
    assert.equal(parsed.hostname, "legalbahi-private-documents.account-test.r2.cloudflarestorage.com");
    assert.equal(parsed.searchParams.get("X-Amz-Expires"), "300");
    assert.equal(await storage.signedDownloadUrl("local:not-an-r2-object"), null);
  } finally {
    S3Client.prototype.send = originalSend;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
