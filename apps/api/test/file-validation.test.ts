import assert from "node:assert/strict";
import test from "node:test";

import { UploadValidationError, validateAudioUpload, validateDocumentUpload } from "../src/lib/file-validation.js";

test("validateDocumentUpload accepts PDF and image headers", () => {
  const pdf = validateDocumentUpload({
    fileName: "order.pdf",
    bytes: Buffer.from("%PDF-1.7 sample"),
    mimeType: "application/pdf",
  });
  assert.equal(pdf.contentType, "application/pdf");

  const png = validateDocumentUpload({
    fileName: "scan.png",
    bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mimeType: "image/png",
  });
  assert.equal(png.contentType, "image/png");
});

test("validateDocumentUpload rejects mismatched or executable uploads", () => {
  assert.throws(
    () =>
      validateDocumentUpload({
        fileName: "bad.exe",
        bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
        mimeType: "application/pdf",
      }),
    UploadValidationError,
  );
  assert.throws(
    () =>
      validateDocumentUpload({
        fileName: "fake.pdf",
        bytes: Buffer.from("not-a-pdf"),
        mimeType: "application/pdf",
      }),
    /does not match/i,
  );
});

test("validateAudioUpload accepts common courtroom recording types", () => {
  const result = validateAudioUpload({
    fileName: "note.m4a",
    bytes: Buffer.from("fake-audio"),
    mimeType: "audio/mp4",
  });
  assert.equal(result.contentType, "audio/mp4");
});
