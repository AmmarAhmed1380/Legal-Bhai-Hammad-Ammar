import sanitizeHtml from "sanitize-html";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

const SCRIPT_OR_STYLE_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function sanitizePlainText(value: string): string {
  const withoutExecutableBlocks = value.replace(SCRIPT_OR_STYLE_BLOCK, "");
  return sanitizeHtml(withoutExecutableBlocks, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

export function sanitizeInput(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizePlainText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeInput(entry)) as JsonLike[];
  }
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] = sanitizeInput(entry);
  }
  return sanitized;
}
