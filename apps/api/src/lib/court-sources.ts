import { normalizeIhcCaseNumber, parseIhcCauseList, fetchIhcCauseList } from "./ihc.js";
import { normalizeGenericCourtCaseNumber } from "./court-html.js";
import { fetchLhcRawalpindiCauseList, parseLhcRawalpindiCauseList } from "./lhc-rawalpindi.js";
import { fetchRawalpindiDistrictCauseList, parseRawalpindiDistrictCauseList } from "./rwp-district.js";

export type { CourtListType, CourtCauseListEntry, CourtSourceDefinition } from "./court-types.js";
export { parseLhcRawalpindiCauseList, parseRawalpindiDistrictCauseList };

import type { CourtCauseListEntry, CourtListType, CourtSourceDefinition } from "./court-types.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

export function normalizeCourtCaseNumber(courtId: string, input: string): string {
  if (courtId === "ihc") {
    return normalizeIhcCaseNumber(input);
  }
  return normalizeGenericCourtCaseNumber(input);
}

export function getCourtSourceDefinition(sourceId: string): CourtSourceDefinition | null {
  return SOURCE_BY_ID.get(sourceId) ?? null;
}

export function isSupportedCourtSource(sourceId: string): boolean {
  return SOURCE_BY_ID.has(sourceId);
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

  if (source.id === "source-lhc-rwp") {
    const causeList = await fetchLhcRawalpindiCauseList(listType, requestedIsoDate);
    return {
      source,
      listDate: causeList.listDate,
      sourceUrl: causeList.sourceUrl,
      rows: causeList.rows,
    };
  }

  const causeList = await fetchRawalpindiDistrictCauseList(listType, requestedIsoDate);
  return {
    source,
    listDate: causeList.listDate,
    sourceUrl: causeList.sourceUrl,
    rows: causeList.rows,
  };
}
