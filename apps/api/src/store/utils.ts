import { createHash } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function decodeJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}
