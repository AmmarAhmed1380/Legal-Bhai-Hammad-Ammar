import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { CourtListType } from "./court-types.js";

export const COURT_FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LegalBhai/1.0";
export const COURT_FETCH_TIMEOUT_MS = 15_000;

export function isCourtLiveFetchEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.COURT_LIVE_FETCH_ENABLED === "true";
}

export function fixturePath(sourceId: string, listDate: string, listType: CourtListType): string {
  const fixtureName = `${sourceId}-${listDate}-${listType}.html`;
  return fileURLToPath(new URL(`../../test/fixtures/${fixtureName}`, import.meta.url));
}

export function readCourtFixture(sourceId: string, listDate: string, listType: CourtListType): string {
  const primaryPath = fixturePath(sourceId, listDate, listType);
  if (existsSync(primaryPath)) {
    return readFileSync(primaryPath, "utf8");
  }
  const defaultDate = sourceId === "source-ihc" ? "2026-04-20" : "2026-07-15";
  const fallbackPath = fixturePath(sourceId, defaultDate, listType);
  if (existsSync(fallbackPath)) {
    return readFileSync(fallbackPath, "utf8");
  }
  throw new Error(`Fixture file not found: ${primaryPath}`);
}

export async function fetchCourtHtml(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": COURT_FETCH_USER_AGENT,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(COURT_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Court server returned status ${response.status} for ${url}`);
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error(`Court server returned an empty response for ${url}`);
  }
  if (/service unavailable|under maintenance|404 not found|access denied/i.test(html)) {
    throw new Error(`Court server returned an unusable page for ${url}`);
  }
  return html;
}

export function logCourtSourceWarning(sourceName: string, message: string): void {
  console.warn(`[court-source:${sourceName}] ${message}`);
}

export async function withCourtFixtureFallback<T>(
  sourceName: string,
  sourceId: string,
  listDate: string,
  listType: CourtListType,
  liveFetch: () => Promise<T>,
  toFixtureResult: (html: string) => T,
): Promise<T> {
  if (!isCourtLiveFetchEnabled()) {
    return toFixtureResult(readCourtFixture(sourceId, listDate, listType));
  }

  try {
    return await liveFetch();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown court fetch failure";
    if (process.env.NODE_ENV === "production") {
      throw error instanceof Error ? error : new Error(message);
    }
    logCourtSourceWarning(sourceName, `Live fetch failed (${message}). Falling back to local fixture.`);
    return toFixtureResult(readCourtFixture(sourceId, listDate, listType));
  }
}
