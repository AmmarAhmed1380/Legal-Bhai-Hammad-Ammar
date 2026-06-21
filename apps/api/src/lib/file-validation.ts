import { scanDocumentBuffer } from "./malware-scan.js";

const PDF_MAGIC = Buffer.from("%PDF");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF_MAGIC = Buffer.from("GIF8");
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_MARKER = Buffer.from("WEBP");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MZ_MAGIC = Buffer.from([0x4d, 0x5a]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function startsWith(bytes: Buffer, magic: Buffer): boolean {
  return bytes.length >= magic.length && bytes.subarray(0, magic.length).equals(magic);
}

function detectKind(bytes: Buffer): "pdf" | "jpeg" | "png" | "gif" | "webp" | "unknown" {
  if (startsWith(bytes, PDF_MAGIC)) {
    return "pdf";
  }
  if (startsWith(bytes, JPEG_MAGIC)) {
    return "jpeg";
  }
  if (startsWith(bytes, PNG_MAGIC)) {
    return "png";
  }
  if (startsWith(bytes, GIF_MAGIC)) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    startsWith(bytes, WEBP_RIFF) &&
    bytes.subarray(8, 12).equals(WEBP_MARKER)
  ) {
    return "webp";
  }
  return "unknown";
}

function mimeForKind(kind: ReturnType<typeof detectKind>): string | null {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

export function validateDocumentUpload(input: {
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): { contentType: string } {
  if (input.bytes.length === 0) {
    throw new UploadValidationError("Upload is empty");
  }
  if (input.bytes.length > 15 * 1024 * 1024) {
    throw new UploadValidationError("Upload exceeds the 15 MB limit");
  }
  if (startsWith(input.bytes, ZIP_MAGIC) || startsWith(input.bytes, MZ_MAGIC)) {
    throw new UploadValidationError("Executable or archive uploads are not allowed");
  }

  const extension = input.fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadValidationError(`Unsupported file extension: ${extension}`);
  }

  const declaredMime = input.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declaredMime && !ALLOWED_MIME_TYPES.has(declaredMime)) {
    throw new UploadValidationError(`Unsupported content type: ${declaredMime}`);
  }

  const kind = detectKind(input.bytes);
  const detectedMime = mimeForKind(kind);
  if (!detectedMime) {
    throw new UploadValidationError("File header does not match an allowed PDF or image format");
  }
  if (declaredMime && declaredMime !== detectedMime && !(declaredMime === "image/jpg" && detectedMime === "image/jpeg")) {
    throw new UploadValidationError("Declared content type does not match file contents");
  }

  return { contentType: detectedMime };
}

export async function validateAndScanDocumentUpload(input: {
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ contentType: string; scanProviderId: string }> {
  const validated = validateDocumentUpload(input);
  const scan = await scanDocumentBuffer({ bytes: input.bytes, fileName: input.fileName });
  if (!scan.clean) {
    throw new UploadValidationError(
      scan.threatName
        ? `Upload was rejected: ${scan.threatName}`
        : "Upload was rejected because it failed malware scanning",
    );
  }
  return { contentType: validated.contentType, scanProviderId: scan.providerId };
}

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]);

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".webm", ".ogg", ".mp4"]);

export function validateAudioUpload(input: {
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): { contentType: string } {
  if (input.bytes.length === 0) {
    throw new UploadValidationError("Audio upload is empty");
  }
  if (input.bytes.length > 25 * 1024 * 1024) {
    throw new UploadValidationError("Audio upload exceeds the 25 MB limit");
  }
  const extension = input.fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (extension && !AUDIO_EXTENSIONS.has(extension)) {
    throw new UploadValidationError(`Unsupported audio extension: ${extension}`);
  }
  const declaredMime = input.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declaredMime && !AUDIO_MIME_TYPES.has(declaredMime)) {
    throw new UploadValidationError(`Unsupported audio content type: ${declaredMime}`);
  }
  return { contentType: declaredMime || "audio/mpeg" };
}
