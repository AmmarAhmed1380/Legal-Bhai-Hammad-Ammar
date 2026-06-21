import {
  findCaseCell,
  findInputNameMatching,
  isoDateToDisplayDate,
  isHeaderRow,
  normalizeGenericCourtCaseNumber,
  stripHtml,
  tableRows,
  todayInPakistanIso,
} from "./court-html.js";
import {
  fetchCourtHtml,
  isCourtLiveFetchEnabled,
  logCourtSourceWarning,
  readCourtFixture,
  withCourtFixtureFallback,
} from "./court-fetch.js";
import type { CourtCauseListEntry, CourtListType } from "./court-types.js";

const LHC_BASE_URL = "https://data.lhc.gov.pk";
const LHC_RAWALPINDI_SOURCE_URL = `${LHC_BASE_URL}/case_management/regular_cause_list`;

const LHC_LIST_PATHS: Record<CourtListType, string> = {
  regular: "/case_management/regular_cause_list",
  supplementary: "/case_management/supplementary_cause_list",
  urgent: "/case_management/urgent_cause_list_final",
};

function resolveListDateFromHtml(html: string, fallback: string): string {
  const text = stripHtml(html);
  const ddMmYyyy = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (ddMmYyyy) {
    return `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}`;
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return fallback;
}

export function looksLikeLhcCauseListPage(html: string): boolean {
  if (!/<table/i.test(html)) {
    return false;
  }
  return /(cause\s*list|case\s*no|bench|courtroom|rawalpindi|lahore)/i.test(stripHtml(html));
}

function isRawalpindiBenchContext(benchContext: string, rowText: string): boolean {
  const combined = `${benchContext} ${rowText}`;
  if (/rawalpindi/i.test(combined)) {
    return true;
  }
  if (/lahore\s+principal|principal\s+seat|multan\s+bench|bahawalpur\s+bench/i.test(combined)) {
    return false;
  }
  return false;
}

export function parseLhcRawalpindiCauseList(
  html: string,
  options: { listDate: string; listType: CourtListType; sourceUrl?: string },
): CourtCauseListEntry[] {
  if (!looksLikeLhcCauseListPage(html)) {
    throw new Error("LHC Rawalpindi parser received HTML that does not resemble a cause list page");
  }

  let activeBench = "";
  const entries: CourtCauseListEntry[] = [];

  for (const cells of tableRows(html)) {
    const joined = cells.join(" ");
    if (isHeaderRow(cells)) {
      continue;
    }

    if (!findCaseCell(cells) && /(bench|justice|hon'ble|honorable|principal\s+seat)/i.test(joined)) {
      activeBench = joined;
      continue;
    }

    if (!isRawalpindiBenchContext(activeBench, joined)) {
      continue;
    }

    const caseCell = findCaseCell(cells);
    if (!caseCell) {
      continue;
    }

    entries.push({
      courtId: "lhc-rawalpindi-bench",
      rawCaseNumber: caseCell,
      normalizedCaseNumber: normalizeGenericCourtCaseNumber(caseCell),
      courtroom: cells.find((cell) => /court\s*(?:no\.?|room)?/i.test(cell)) ?? null,
      bench: cells.find((cell) => /justice|bench/i.test(cell)) ?? (activeBench || null),
      parties: cells.find((cell) => /\b(vs|versus| v )\b/i.test(cell)) ?? null,
      advocates: cells.find((cell) => /advocate|counsel|lawyer/i.test(cell)) ?? null,
      sourceUrl: options.sourceUrl ?? LHC_RAWALPINDI_SOURCE_URL,
      confidence: 1,
    });
  }

  return entries;
}

function buildLhcFetchUrl(listType: CourtListType, requestedIsoDate?: string): string {
  const path = LHC_LIST_PATHS[listType];
  const url = new URL(path, LHC_BASE_URL);
  if (requestedIsoDate) {
    url.searchParams.set("list_date", isoDateToDisplayDate(requestedIsoDate));
    url.searchParams.set("date", requestedIsoDate);
  }
  return url.toString();
}

async function fetchLiveLhcHtml(listType: CourtListType, requestedIsoDate?: string): Promise<{ html: string; sourceUrl: string }> {
  const sourceUrl = buildLhcFetchUrl(listType, requestedIsoDate);
  const html = await fetchCourtHtml(sourceUrl);
  if (!looksLikeLhcCauseListPage(html)) {
    throw new Error("LHC Rawalpindi live response did not contain a recognizable cause list layout");
  }
  return { html, sourceUrl };
}

export async function fetchLhcRawalpindiCauseList(
  listType: CourtListType = "regular",
  requestedIsoDate?: string,
): Promise<{ listDate: string; rows: CourtCauseListEntry[]; sourceUrl: string }> {
  const fallbackListDate = requestedIsoDate ?? todayInPakistanIso();

  const result = await withCourtFixtureFallback(
    "LHC Rawalpindi",
    "source-lhc-rwp",
    fallbackListDate,
    listType,
    async () => {
      const live = await fetchLiveLhcHtml(listType, requestedIsoDate);
      const listDate = requestedIsoDate ?? resolveListDateFromHtml(live.html, fallbackListDate);
      const rows = parseLhcRawalpindiCauseList(live.html, { listDate, listType, sourceUrl: live.sourceUrl });
      if (rows.length === 0 && isCourtLiveFetchEnabled()) {
        logCourtSourceWarning(
          "LHC Rawalpindi",
          `Live cause list parsed successfully but contained no Rawalpindi Bench rows for ${listDate}.`,
        );
      }
      return { listDate, rows, sourceUrl: live.sourceUrl };
    },
    (html) => {
      const listDate = requestedIsoDate ?? "2026-07-15";
      return {
        listDate,
        rows: parseLhcRawalpindiCauseList(html, { listDate, listType, sourceUrl: LHC_RAWALPINDI_SOURCE_URL }),
        sourceUrl: LHC_RAWALPINDI_SOURCE_URL,
      };
    },
  );

  return result;
}

export function readLhcRawalpindiFixture(listDate: string, listType: CourtListType): string {
  return readCourtFixture("source-lhc-rwp", listDate, listType);
}

export function findLhcDateFieldName(html: string): string | null {
  return findInputNameMatching(html, /date|list/i);
}
