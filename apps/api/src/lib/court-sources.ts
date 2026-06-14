import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fetchIhcCauseList, normalizeIhcCaseNumber, parseIhcCauseList } from "./ihc.js";

export type CourtListType = "regular" | "supplementary" | "urgent";

export interface CourtSourceDefinition {
  id: string;
  courtId: string;
  displayName: string;
  sourceType: string;
  calendarSourceType: string;
  manualReviewSourceType: string;
  officialUrl: string;
  supportedListTypes: CourtListType[];
}

export interface CourtCauseListEntry {
  courtId: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  courtroom: string | null;
  bench: string | null;
  parties: string | null;
  advocates: string | null;
  sourceUrl: string;
  confidence: number;
}

export const COURT_SOURCE_DEFINITIONS: CourtSourceDefinition[] = [
  {
    id: "source-ihc",
    courtId: "ihc",
    displayName: "Islamabad High Court",
    sourceType: "high_court",
    calendarSourceType: "live_ihc",
    manualReviewSourceType: "manual_ihc_review",
    officialUrl: "https://mis.ihc.gov.pk/frmCausLst",
    supportedListTypes: ["regular", "supplementary", "urgent"],
  },
  {
    id: "source-lhc-rwp",
    courtId: "lhc-rawalpindi-bench",
    displayName: "Lahore High Court Rawalpindi Bench",
    sourceType: "high_court",
    calendarSourceType: "live_lhc_rwp",
    manualReviewSourceType: "manual_lhc_rwp_review",
    officialUrl: "https://data.lhc.gov.pk/case_management/regular_cause_list",
    supportedListTypes: ["regular", "supplementary", "urgent"],
  },
  {
    id: "source-rwp-district",
    courtId: "rwp-district-sessions",
    displayName: "Rawalpindi District & Sessions Courts",
    sourceType: "district",
    calendarSourceType: "live_rwp_district",
    manualReviewSourceType: "manual_rwp_district_review",
    officialUrl: "https://rawalpindi.dc.lhc.gov.pk/PublicPages/CauseList.aspx",
    supportedListTypes: ["regular"],
  },
];

const SOURCE_BY_ID = new Map(COURT_SOURCE_DEFINITIONS.map((source) => [source.id, source]));

const CASE_TYPE_ALIASES: Array<[RegExp, string]> = [
  [/\bW\.?\s*P\.?\b/g, "WRIT PETITION"],
  [/\bC\.?\s*R\.?\b/g, "CIVIL REVISION"],
  [/\bC\.?\s*S\.?\b/g, "CIVIL SUIT"],
  [/\bF\.?\s*A\.?\b/g, "FAMILY APPEAL"],
  [/\bCrl\.?\s*Rev(?:ision)?\.?\b/gi, "CRIMINAL REVISION"],
  [/\bCrl\.?\s*Appeal\b/gi, "CRIMINAL APPEAL"],
  [/\bCriminal\s+Revision\b/gi, "CRIMINAL REVISION"],
  [/\bCivil\s+Suit\b/gi, "CIVIL SUIT"],
  [/\bFamily\s+Suit\b/gi, "FAMILY SUIT"],
];

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(input: string): string {
  return decodeHtml(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLabel(label: string): string {
  let normalized = label
    .toUpperCase()
    .replace(/[,:]/g, " ")
    .replace(/\bNO\.?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of CASE_TYPE_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function normalizeCourtCaseNumber(courtId: string, input: string): string {
  if (courtId === "ihc") {
    return normalizeIhcCaseNumber(input);
  }

  const text = stripHtml(input)
    .replace(/\s+OF\s+/gi, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  const matches = [...text.matchAll(/([A-Z][A-Z .&()/'-]+?)\s*\.?\s*(\d+)\s*\/\s*(\d{4})/gi)];
  const match = matches.at(-1);
  if (!match) {
    return normalizeLabel(text);
  }

  const [, rawLabel, number, year] = match;
  return `${normalizeLabel(rawLabel)} ${number}/${year}`;
}

export function getCourtSourceDefinition(sourceId: string): CourtSourceDefinition | null {
  return SOURCE_BY_ID.get(sourceId) ?? null;
}

export function isSupportedCourtSource(sourceId: string): boolean {
  return SOURCE_BY_ID.has(sourceId);
}

function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtml(cell[1])))
    .filter((cells) => cells.length > 0);
}

function isHeaderRow(cells: string[]): boolean {
  const labels = new Set(cells.map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim()));
  return (
    (labels.has("case no") || labels.has("case number")) &&
    (labels.has("parties") || labels.has("party")) &&
    (labels.has("advocates") || labels.has("advocate"))
  );
}

function findCaseCell(cells: string[]): string | null {
  return cells.find((cell) => /[A-Z][A-Z .&()/'-]+?\s*\.?\s*\d+\s*\/\s*\d{4}/i.test(cell)) ?? null;
}

export function parseLhcRawalpindiCauseList(
  html: string,
  options: { listDate: string; listType: CourtListType; sourceUrl?: string },
): CourtCauseListEntry[] {
  return tableRows(html).flatMap((cells) => {
    const joined = cells.join(" ");
    if (isHeaderRow(cells) || !/rawalpindi/i.test(joined)) {
      return [];
    }
    const caseCell = findCaseCell(cells);
    if (!caseCell) {
      return [];
    }
    return [{
      courtId: "lhc-rawalpindi-bench",
      rawCaseNumber: caseCell,
      normalizedCaseNumber: normalizeCourtCaseNumber("lhc-rawalpindi-bench", caseCell),
      courtroom: cells.find((cell) => /court/i.test(cell)) ?? null,
      bench: cells.find((cell) => /justice|bench/i.test(cell)) ?? null,
      parties: cells.find((cell) => /\b(vs|versus| v )\b/i.test(cell)) ?? null,
      advocates: cells.find((cell) => /advocate|counsel|lawyer/i.test(cell)) ?? null,
      sourceUrl: options.sourceUrl ?? SOURCE_BY_ID.get("source-lhc-rwp")!.officialUrl,
      confidence: 1,
    }];
  });
}

export function parseRawalpindiDistrictCauseList(
  html: string,
  options: { listDate: string; listType: CourtListType; sourceUrl?: string },
): CourtCauseListEntry[] {
  return tableRows(html).flatMap((cells) => {
    if (isHeaderRow(cells)) {
      return [];
    }
    const caseCell = findCaseCell(cells);
    if (!caseCell) {
      return [];
    }
    const normalized = normalizeCourtCaseNumber("rwp-district-sessions", caseCell);
    const courtId = /family/i.test(normalized)
      ? "rwp-family-courts"
      : /criminal|magisterial|fir/i.test(normalized)
        ? "rwp-criminal-magisterial"
        : /civil/i.test(normalized)
          ? "rwp-civil-courts"
          : "rwp-district-sessions";
    return [{
      courtId,
      rawCaseNumber: caseCell,
      normalizedCaseNumber: normalizeCourtCaseNumber(courtId, caseCell),
      courtroom: cells.find((cell) => /court|room/i.test(cell)) ?? null,
      bench: cells.find((cell) => /judge|sessions|civil|family|magistrate/i.test(cell)) ?? null,
      parties: cells.find((cell) => /\b(vs|versus| v )\b/i.test(cell)) ?? null,
      advocates: cells.find((cell) => /advocate|counsel|lawyer/i.test(cell)) ?? null,
      sourceUrl: options.sourceUrl ?? SOURCE_BY_ID.get("source-rwp-district")!.officialUrl,
      confidence: 1,
    }];
  });
}

function fixturePath(sourceId: string, listDate: string, listType: CourtListType): string {
  const fixtureName = `${sourceId}-${listDate}-${listType}.html`;
  return fileURLToPath(new URL(`../../test/fixtures/${fixtureName}`, import.meta.url));
}

export async function fetchCourtCauseList(
  sourceId: string,
  listType: CourtListType = "regular",
  requestedIsoDate?: string,
): Promise<{ source: CourtSourceDefinition; listDate: string; rows: CourtCauseListEntry[]; sourceUrl: string }> {
  const source = getCourtSourceDefinition(sourceId);
  if (!source) {
    throw new Error(`Unsupported court source: ${sourceId}`);
  }
  if (!source.supportedListTypes.includes(listType)) {
    throw new Error(`${source.displayName} does not support ${listType} lists`);
  }

  if (source.id === "source-ihc") {
    const causeList = await fetchIhcCauseList(listType, requestedIsoDate);
    return {
      source,
      listDate: causeList.listDate,
      sourceUrl: source.officialUrl,
      rows: parseIhcCauseList(causeList.html).map((row) => ({
        courtId: "ihc",
        rawCaseNumber: row.caseNumber,
        normalizedCaseNumber: normalizeIhcCaseNumber(row.caseNumber),
        courtroom: row.court || null,
        bench: row.judgeNames || null,
        parties: row.parties || null,
        advocates: row.advocates || null,
        sourceUrl: source.officialUrl,
        confidence: 1,
      })),
    };
  }

  const listDate = requestedIsoDate ?? "2026-07-15";
  const html = readFileSync(fixturePath(source.id, listDate, listType), "utf8");
  const rows = source.id === "source-lhc-rwp"
    ? parseLhcRawalpindiCauseList(html, { listDate, listType, sourceUrl: source.officialUrl })
    : parseRawalpindiDistrictCauseList(html, { listDate, listType, sourceUrl: source.officialUrl });

  return { source, listDate, rows, sourceUrl: source.officialUrl };
}
